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
  private readonly RENAME_WINDOW_MS = 300

  constructor(private contextTrackManager: ContextTrackManager) {
    // Watch everything; filtering happens in the handler for performance
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*')

    this.watcher.onDidDelete((uri) => this.onDelete(uri))
    this.watcher.onDidCreate((uri) => this.onCreate(uri))
  }

  /**
   * On delete, we wait briefly to see if a matching 'create' follows (rename).
   * If not, we confirm the delete.
   */
  private onDelete(uri: vscode.Uri): void {
    // Optimization: Ignore events for files not in any track
    if (!this.contextTrackManager.hasUri(uri)) return

    const key = this.getFileKey(uri)

    // Clear any existing timer for this file key
    if (this.pendingRenames.has(key)) {
      clearTimeout(this.pendingRenames.get(key)!.timer)
    }

    const timer = setTimeout(() => {
      this.commitDelete(uri, key)
    }, this.RENAME_WINDOW_MS)

    this.pendingRenames.set(key, { oldUri: uri, timer })
  }

  /**
   * On create, we check if this file matches a pending delete (heuristically).
   * If it does, we treat it as a rename/move.
   */
  private onCreate(newUri: vscode.Uri): void {
    const key = this.getFileKey(newUri)
    const pending = this.pendingRenames.get(key)

    if (pending) {
      // It's a rename! Cancel the delete and update the reference.
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
   * Using basename allows us to detect moves (folder1/a.ts -> folder2/a.ts).
   */
  private getFileKey(uri: vscode.Uri): string {
    return path.basename(uri.fsPath)
  }

  dispose() {
    this.watcher.dispose()
    this.pendingRenames.forEach((v) => clearTimeout(v.timer))
  }
}
