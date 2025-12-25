import * as path from 'path'
import * as vscode from 'vscode'

import { TrackManager } from '../providers'
import { Logger } from '../utils'

/**
 * Monitors the workspace for file system events to keep tracked files in sync.
 */
export class FileWatcherService implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher
  private pendingDeletes = new Set<string>()
  private pendingCreates = new Set<string>()

  private batchTimer: ReturnType<typeof setTimeout> | undefined
  private _isDisposed = false
  private readonly BATCH_DELAY_MS = 200

  constructor(private readonly contextTrackManager: TrackManager) {
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*')
    this.watcher.onDidDelete((uri) => this.bufferEvent(uri, 'DELETE'))
    this.watcher.onDidCreate((uri) => this.bufferEvent(uri, 'CREATE'))
  }

  public dispose(): void {
    this._isDisposed = true
    this.watcher.dispose()
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = undefined
    }
    this.pendingDeletes.clear()
    this.pendingCreates.clear()
  }

  private bufferEvent(uri: vscode.Uri, type: 'DELETE' | 'CREATE'): void {
    if (this._isDisposed) return
    const key = uri.toString()

    if (type === 'DELETE') {
      this.pendingDeletes.add(key)
    } else {
      this.pendingCreates.add(key)
    }

    this.scheduleBatch()
  }

  private scheduleBatch(): void {
    if (this._isDisposed || this.batchTimer) return

    this.batchTimer = setTimeout(() => {
      this.batchTimer = undefined
      void this.flushBuffer().catch((err) => {
        Logger.error('Error processing file watcher batch', err)
      })
    }, this.BATCH_DELAY_MS)
  }

  private async flushBuffer(): Promise<void> {
    if (this._isDisposed || (this.pendingDeletes.size === 0 && this.pendingCreates.size === 0)) return

    const deletes = Array.from(this.pendingDeletes)
    const creates = new Set(this.pendingCreates)

    this.pendingDeletes.clear()
    this.pendingCreates.clear()

    const creationIndex = this.buildCreationIndex(creates)
    this.processDeletions(deletes, creationIndex)
  }

  private buildCreationIndex(creates: Set<string>): Map<string, string> {
    const map = new Map<string, string>()
    for (const createStr of creates) {
      const uri = vscode.Uri.parse(createStr)
      const base = path.basename(uri.fsPath)
      map.set(base, createStr)
    }
    return map
  }

  private processDeletions(deletes: string[], creationIndex: Map<string, string>): void {
    for (const deleteStr of deletes) {
      if (this._isDisposed) return

      const deleteUri = vscode.Uri.parse(deleteStr)
      // Optimization: Ignore events for files that aren't currently being tracked
      if (!this.contextTrackManager.hasUri(deleteUri)) continue

      this.resolveFileChange(deleteUri, creationIndex)
    }
  }

  private resolveFileChange(deleteUri: vscode.Uri, creationIndex: Map<string, string>): void {
    const baseName = path.basename(deleteUri.fsPath)
    const matchStr = creationIndex.get(baseName)

    if (matchStr) {
      this.executeRename(deleteUri, matchStr)
    } else {
      this.executeDelete(deleteUri)
    }
  }

  private executeRename(oldUri: vscode.Uri, newStr: string): void {
    const newUri = vscode.Uri.parse(newStr)
    this.contextTrackManager.replaceUri(oldUri, newUri)
    Logger.info(`Auto-updated renamed file: ${oldUri.fsPath} -> ${newUri.fsPath}`)
  }

  private executeDelete(uri: vscode.Uri): void {
    this.contextTrackManager.removeUriEverywhere(uri)
    Logger.info(`Auto-removed deleted file: ${uri.fsPath}`)
  }
}
