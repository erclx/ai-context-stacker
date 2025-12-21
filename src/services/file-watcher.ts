import * as path from 'path'
import * as vscode from 'vscode'

import { ContextTrackManager } from '../providers'
import { Logger } from '../utils'

/**
 * Monitors file system events using a batched scheduler.
 * Handles high-frequency events (git checkout, npm install) safely.
 */
export class FileWatcherService implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher
  private pendingDeletes = new Set<string>()
  private pendingCreates = new Set<string>()
  private batchTimer: NodeJS.Timeout | undefined
  private _isDisposed = false

  private readonly BATCH_DELAY_MS = 200

  constructor(private readonly contextTrackManager: ContextTrackManager) {
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*')
    this.watcher.onDidDelete((uri) => this.bufferEvent(uri, 'DELETE'))
    this.watcher.onDidCreate((uri) => this.bufferEvent(uri, 'CREATE'))
  }

  /**
   * Adds an event to the buffer and schedules a flush.
   * Uses string keys to minimize memory footprint during event storms.
   */
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
      this.flushBuffer().catch((err) => {
        Logger.error('Error processing file watcher batch', err)
      })
    }, this.BATCH_DELAY_MS)
  }

  /**
   * Processes all buffered events.
   * Uses an Indexing Phase and Correlation Phase to achieve O(N+M) complexity.
   */
  private async flushBuffer(): Promise<void> {
    if (this._isDisposed) return
    if (this.pendingDeletes.size === 0 && this.pendingCreates.size === 0) return

    // Snapshot to unblock the event loop immediately
    const deletes = Array.from(this.pendingDeletes)
    const creates = new Set(this.pendingCreates)

    this.pendingDeletes.clear()
    this.pendingCreates.clear()

    const creationIndex = this.buildCreationIndex(creates)
    this.processDeletions(deletes, creationIndex)
  }

  /**
   * Phase 2: Indexing
   * Maps file base names to their full URI strings for O(1) lookup.
   */
  private buildCreationIndex(creates: Set<string>): Map<string, string> {
    const map = new Map<string, string>()

    for (const createStr of creates) {
      const uri = vscode.Uri.parse(createStr)
      const base = path.basename(uri.fsPath)
      map.set(base, createStr)
    }

    return map
  }

  /**
   * Phase 3: Correlation
   * Iterates deletions and checks the index to distinguish Renames from Deletes.
   */
  private processDeletions(deletes: string[], creationIndex: Map<string, string>): void {
    for (const deleteStr of deletes) {
      if (this._isDisposed) return
      this.resolveFileChange(deleteStr, creationIndex)
    }
  }

  private resolveFileChange(deleteStr: string, creationIndex: Map<string, string>): void {
    const deleteUri = vscode.Uri.parse(deleteStr)

    // Optimization: Skip expensive logic if the file wasn't tracked anyway
    if (!this.contextTrackManager.hasUri(deleteUri)) return

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

  dispose() {
    this._isDisposed = true
    this.watcher.dispose()
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
    }
    this.pendingDeletes.clear()
    this.pendingCreates.clear()
  }
}
