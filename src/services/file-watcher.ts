import * as path from 'path'
import * as vscode from 'vscode'

import { ContextTrackManager } from '../providers'
import { Logger } from '../utils'

/**
 * Monitors the workspace for file system events to keep tracked files in sync.
 * * Responsibilities:
 * - Auto-removes files from the stack when deleted from disk.
 * - Detects file renames/moves by correlating quasi-simultaneous 'Delete' and 'Create' events.
 * (VS Code's FileWatcher often emits renames as a split Delete+Create pair).
 */
export class FileWatcherService implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher
  private pendingDeletes = new Set<string>()
  private pendingCreates = new Set<string>()

  /** * Timer handle. Typed generally to support both Node.js (Electron) and Browser (Web) environments.
   */
  private batchTimer: ReturnType<typeof setTimeout> | undefined
  private _isDisposed = false

  /** * The window of time (in ms) to wait for a matching 'Create' event after a 'Delete' is detected.
   * This forms the heuristic transaction window for identifying renames.
   */
  private readonly BATCH_DELAY_MS = 200

  constructor(private readonly contextTrackManager: ContextTrackManager) {
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*')
    this.watcher.onDidDelete((uri) => this.bufferEvent(uri, 'DELETE'))
    this.watcher.onDidCreate((uri) => this.bufferEvent(uri, 'CREATE'))
  }

  /**
   * buffers incoming FS events to be processed in a single batch.
   * This allows us to analyze relationships between events (e.g. Delete + Create = Rename).
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
   * Attempts to match Deletions to Creations based on filenames to infer Renames.
   */
  private async flushBuffer(): Promise<void> {
    if (this._isDisposed) return
    if (this.pendingDeletes.size === 0 && this.pendingCreates.size === 0) return

    const deletes = Array.from(this.pendingDeletes)
    const creates = new Set(this.pendingCreates)

    this.pendingDeletes.clear()
    this.pendingCreates.clear()

    const creationIndex = this.buildCreationIndex(creates)
    this.processDeletions(deletes, creationIndex)
  }

  /**
   * Maps filenames (basename) to their full URI strings for quick lookup.
   * Used to find if a deleted file has re-appeared elsewhere.
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

  private processDeletions(deletes: string[], creationIndex: Map<string, string>): void {
    for (const deleteStr of deletes) {
      if (this._isDisposed) return
      this.resolveFileChange(deleteStr, creationIndex)
    }
  }

  /**
   * Decides if a deletion is a simple removal or part of a rename operation.
   * Heuristic: If a file with the same basename was created in the same batch, treat as Rename.
   */
  private resolveFileChange(deleteStr: string, creationIndex: Map<string, string>): void {
    const deleteUri = vscode.Uri.parse(deleteStr)

    // Optimization: Ignore events for files that aren't currently being tracked
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
