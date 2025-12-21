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

  // Batching buffers
  private pendingDeletes = new Set<string>()
  private pendingCreates = new Set<string>()
  private batchTimer: NodeJS.Timeout | undefined

  // Configuration
  private readonly BATCH_DELAY_MS = 200

  constructor(private contextTrackManager: ContextTrackManager) {
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*')

    this.watcher.onDidDelete((uri) => this.bufferEvent(uri, 'DELETE'))
    this.watcher.onDidCreate((uri) => this.bufferEvent(uri, 'CREATE'))
  }

  /**
   * Adds an event to the buffer and schedules a flush.
   * Debounces execution to handle event storms efficiently.
   */
  private bufferEvent(uri: vscode.Uri, type: 'DELETE' | 'CREATE'): void {
    const key = uri.toString()

    if (type === 'DELETE') {
      this.pendingDeletes.add(key)
    } else {
      this.pendingCreates.add(key)
    }

    this.scheduleBatch()
  }

  private scheduleBatch(): void {
    if (this.batchTimer) return

    this.batchTimer = setTimeout(() => {
      this.batchTimer = undefined
      this.flushBuffer().catch((err) => {
        Logger.error('Error processing file watcher batch', err)
      })
    }, this.BATCH_DELAY_MS)
  }

  /**
   * Processes all buffered events in a single pass.
   * Correlates Deletes and Creates to detect Renames.
   */
  private async flushBuffer(): Promise<void> {
    if (this.pendingDeletes.size === 0 && this.pendingCreates.size === 0) return

    // Snapshot and clear buffers immediately to allow new events to queue
    const deletes = Array.from(this.pendingDeletes)
    const creates = new Set(this.pendingCreates)

    this.pendingDeletes.clear()
    this.pendingCreates.clear()

    this.processSnapshot(deletes, creates)
  }

  /**
   * Analyzes the snapshot to distinguish between Deletes and Renames.
   */
  private processSnapshot(deletes: string[], creates: Set<string>): void {
    for (const deleteStr of deletes) {
      const deleteUri = vscode.Uri.parse(deleteStr)

      if (!this.contextTrackManager.hasUri(deleteUri)) continue

      this.handleTrackedFileChange(deleteUri, creates)
    }
  }

  /**
   * Logic to determine if a tracked file was Deleted or Renamed.
   */
  private handleTrackedFileChange(oldUri: vscode.Uri, creates: Set<string>): void {
    const oldBaseName = path.basename(oldUri.fsPath)

    // Heuristic: Check if any created file has the same basename (Move/Rename)
    // We search the 'creates' batch for a match.
    const matchStr = Array.from(creates).find((createStr) => {
      const createUri = vscode.Uri.parse(createStr)
      return path.basename(createUri.fsPath) === oldBaseName
    })

    if (matchStr) {
      const newUri = vscode.Uri.parse(matchStr)
      this.contextTrackManager.replaceUri(oldUri, newUri)
      Logger.info(`Auto-updated renamed file: ${oldUri.fsPath} -> ${newUri.fsPath}`)
    } else {
      // No matching creation found -> It's a genuine delete
      this.contextTrackManager.removeUriEverywhere(oldUri)
      Logger.info(`Auto-removed deleted file: ${oldUri.fsPath}`)
    }
  }

  dispose() {
    this.watcher.dispose()
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
    }
    this.pendingDeletes.clear()
    this.pendingCreates.clear()
  }
}
