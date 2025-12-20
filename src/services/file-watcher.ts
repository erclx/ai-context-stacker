import * as path from 'path'
import * as vscode from 'vscode'

import { ContextTrackManager } from '../providers'
import { Logger } from '../utils'

interface PendingRename {
  oldUri: vscode.Uri
  timer: NodeJS.Timeout
}

/**
 * Monitors the file system for changes to staged files.
 * Handles auto-removal on delete and auto-update on rename.
 */
export class FileWatcherService implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher
  private pendingRenames = new Map<string, PendingRename>()
  // Window to correlate a delete event with a subsequent create event (VS Code rename behavior)
  private readonly RENAME_WINDOW_MS = 300

  constructor(private contextTrackManager: ContextTrackManager) {
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*')

    this.watcher.onDidDelete((uri) => this.onDelete(uri))
    this.watcher.onDidCreate((uri) => this.onCreate(uri))
  }

  /**
   * Handles delete events with delay to detect renames.
   *
   * Race condition handling:
   * VS Code fires onDidDelete immediately, then onDidCreate shortly after for renames.
   * We wait RENAME_WINDOW_MS to see if a matching create event arrives.
   * If no create event comes, we commit the delete.
   * This prevents flickering UI and lost state during file moves/renames.
   */
  private onDelete(uri: vscode.Uri): void {
    if (!this.contextTrackManager.hasUri(uri)) return

    const key = this.getFileKey(uri)

    if (this.pendingRenames.has(key)) {
      clearTimeout(this.pendingRenames.get(key)!.timer)
    }

    const timer = setTimeout(() => {
      this.commitDelete(uri, key)
    }, this.RENAME_WINDOW_MS)

    this.pendingRenames.set(key, { oldUri: uri, timer })
  }

  /**
   * Handles create events, checking for pending deletes to detect renames.
   * Basename-based matching allows detection of folder moves (a/file.ts -> b/file.ts).
   */
  private onCreate(newUri: vscode.Uri): void {
    const key = this.getFileKey(newUri)
    const pending = this.pendingRenames.get(key)

    if (pending) {
      clearTimeout(pending.timer)
      this.pendingRenames.delete(key)

      this.contextTrackManager.replaceUri(pending.oldUri, newUri)
      Logger.info(`Auto-updated renamed file: ${pending.oldUri.fsPath} -> ${newUri.fsPath}`)
    }
  }

  private commitDelete(uri: vscode.Uri, key: string): void {
    this.pendingRenames.delete(key)
    this.contextTrackManager.removeUriEverywhere(uri)
    Logger.info(`Auto-removed deleted file: ${uri.fsPath}`)
  }

  /**
   * Generates a key for tracking renames.
   * Uses basename to detect both renames and moves across folders.
   */
  private getFileKey(uri: vscode.Uri): string {
    return path.basename(uri.fsPath)
  }

  dispose() {
    this.watcher.dispose()
    this.pendingRenames.forEach((v) => clearTimeout(v.timer))
  }
}
