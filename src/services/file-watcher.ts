import * as path from 'path'
import * as vscode from 'vscode'

import { ContextTrack } from '../models'
import { TrackManager } from '../providers'
import { Logger } from '../utils'

export class FileWatcherService implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | undefined
  private pendingDeletes = new Set<string>()
  private pendingCreates = new Set<string>()

  private batchTimer: ReturnType<typeof setTimeout> | undefined
  private _isDisposed = false
  private readonly BATCH_DELAY_MS = 200
  private disposables: vscode.Disposable[] = []

  constructor(private readonly trackManager: TrackManager) {
    this.disposables.push(trackManager.onDidChangeTrack((track) => this.rebuildWatcher(track)))

    this.rebuildWatcher(trackManager.getActiveTrack())
  }

  public dispose(): void {
    if (this._isDisposed) return
    this._isDisposed = true

    this.disposeWatcher()
    this.clearTimer()

    this.disposables.forEach((d) => d.dispose())
    this.pendingDeletes.clear()
    this.pendingCreates.clear()

    Logger.info('FileWatcherService: Fully terminated.')
  }

  private rebuildWatcher(track: ContextTrack): void {
    this.disposeWatcher()

    const paths = track.files.map((f) => f.uri.fsPath)
    if (paths.length === 0) return

    const globPattern = this.generateScopedGlob(paths)
    this.createWatcher(globPattern)
  }

  private generateScopedGlob(paths: string[]): string {
    const sanitized = paths.map((p) => p.replace(/\\/g, '/'))
    return sanitized.length === 1 ? sanitized[0] : `{${sanitized.join(',')}}`
  }

  private createWatcher(pattern: string): void {
    try {
      this.watcher = vscode.workspace.createFileSystemWatcher(pattern)

      this.disposables.push(
        this.watcher.onDidDelete((uri) => this.bufferEvent(uri, 'DELETE')),
        this.watcher.onDidCreate((uri) => this.bufferEvent(uri, 'CREATE')),
      )

      Logger.info('FileWatcherService: Scoped watcher active.')
    } catch (err) {
      Logger.error('Failed to create scoped watcher', err as Error)
    }
  }

  private disposeWatcher(): void {
    this.watcher?.dispose()
    this.watcher = undefined
  }

  private bufferEvent(uri: vscode.Uri, type: 'DELETE' | 'CREATE'): void {
    if (this._isDisposed) return
    const key = uri.toString()

    if (type === 'DELETE') this.pendingDeletes.add(key)
    else this.pendingCreates.add(key)

    this.scheduleBatch()
  }

  private scheduleBatch(): void {
    if (this.batchTimer) return
    this.batchTimer = setTimeout(() => this.processBatch(), this.BATCH_DELAY_MS)
  }

  private processBatch(): void {
    this.clearTimer()
    void this.flushBuffer().catch((err) => {
      Logger.error('Error processing watcher batch', err)
    })
  }

  private clearTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = undefined
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this._isDisposed) return

    const deletes = Array.from(this.pendingDeletes)
    const creates = new Set(this.pendingCreates)

    this.pendingDeletes.clear()
    this.pendingCreates.clear()

    if (deletes.length === 0 && creates.size === 0) return

    const creationIndex = this.buildCreationIndex(creates)
    this.processDeletions(deletes, creationIndex)
  }

  private buildCreationIndex(creates: Set<string>): Map<string, string> {
    const map = new Map<string, string>()
    for (const createStr of creates) {
      const base = path.basename(vscode.Uri.parse(createStr).fsPath)
      map.set(base, createStr)
    }
    return map
  }

  private processDeletions(deletes: string[], creationIndex: Map<string, string>): void {
    for (const deleteStr of deletes) {
      const deleteUri = vscode.Uri.parse(deleteStr)
      if (!this.trackManager.hasUri(deleteUri)) continue

      this.resolveFileChange(deleteUri, creationIndex)
    }
  }

  private resolveFileChange(deleteUri: vscode.Uri, creationIndex: Map<string, string>): void {
    const baseName = path.basename(deleteUri.fsPath)
    const matchStr = creationIndex.get(baseName)

    if (matchStr) {
      const newUri = vscode.Uri.parse(matchStr)
      this.trackManager.replaceUri(deleteUri, newUri)
      Logger.info(`Auto-rename: ${baseName}`)
    } else {
      this.trackManager.removeUriEverywhere(deleteUri)
      Logger.info(`Auto-delete: ${baseName}`)
    }
  }
}
