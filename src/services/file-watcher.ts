import * as vscode from 'vscode'

import { ContextTrack } from '../models'
import { TrackManager } from '../providers'
import { Logger } from '../utils'

export class FileWatcherService implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | undefined
  private pendingDeletes = new Set<string>()
  private batchTimer: ReturnType<typeof setTimeout> | undefined
  private _isDisposed = false
  private readonly BATCH_DELAY_MS = 200
  private disposables: vscode.Disposable[] = []

  constructor(private readonly trackManager: TrackManager) {
    this.disposables.push(
      vscode.workspace.onDidRenameFiles((e) => this.handleRename(e)),
      vscode.workspace.onDidDeleteFiles((e) => this.handleDelete(e)),
    )

    if (!vscode.env.remoteName) {
      this.disposables.push(trackManager.onDidChangeTrack((track) => this.rebuildWatcher(track)))
      this.rebuildWatcher(trackManager.getActiveTrack())
      Logger.info('FileWatcher: Local environment detected. Fallback watcher active.')
    } else {
      Logger.info('FileWatcher: Remote environment detected. Low-level watcher disabled.')
    }
  }

  public dispose(): void {
    if (this._isDisposed) return
    this._isDisposed = true

    this.disposeWatcher()
    this.clearTimer()

    this.disposables.forEach((d) => d.dispose())
    this.pendingDeletes.clear()

    Logger.info('FileWatcherService: Fully terminated.')
  }

  private handleRename(e: vscode.FileRenameEvent): void {
    for (const { oldUri, newUri } of e.files) {
      if (this.trackManager.hasUri(oldUri)) {
        this.trackManager.replaceUri(oldUri, newUri)
        Logger.info(`Synced rename: ${oldUri.fsPath} -> ${newUri.fsPath}`)
      }
    }
  }

  private handleDelete(e: vscode.FileDeleteEvent): void {
    for (const uri of e.files) {
      if (this.trackManager.hasUri(uri)) {
        this.trackManager.removeUriEverywhere(uri)
        Logger.info(`Synced delete: ${uri.fsPath}`)
      }
    }
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
      this.watcher = vscode.workspace.createFileSystemWatcher(pattern, true, true, false)

      this.disposables.push(this.watcher.onDidDelete((uri) => this.bufferExternalDelete(uri)))
    } catch (err) {
      Logger.error('Failed to create local watcher', err as Error)
    }
  }

  private disposeWatcher(): void {
    this.watcher?.dispose()
    this.watcher = undefined
  }

  private bufferExternalDelete(uri: vscode.Uri): void {
    if (this._isDisposed) return
    this.pendingDeletes.add(uri.toString())
    this.scheduleBatch()
  }

  private scheduleBatch(): void {
    if (this.batchTimer) return
    this.batchTimer = setTimeout(() => this.processBatch(), this.BATCH_DELAY_MS)
  }

  private processBatch(): void {
    this.clearTimer()
    if (this._isDisposed || this.pendingDeletes.size === 0) return

    const deletes = Array.from(this.pendingDeletes)
    this.pendingDeletes.clear()

    for (const deleteStr of deletes) {
      const uri = vscode.Uri.parse(deleteStr)
      if (this.trackManager.hasUri(uri)) {
        this.trackManager.removeUriEverywhere(uri)
      }
    }
  }

  private clearTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = undefined
    }
  }
}
