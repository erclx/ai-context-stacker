import * as vscode from 'vscode'

import { type StagedFile } from '../models'
import { Logger } from '../utils'

/**
 * Manages the state and provides the data for the main Context Stack Tree View.
 * Implements the TreeDataProvider interface and handles file addition/removal.
 */
export class ContextStackProvider implements vscode.TreeDataProvider<StagedFile>, vscode.Disposable {
  // The core state: an array of staged file objects
  private files: StagedFile[] = []

  // Event emitter to signal VS Code that the data has changed and the view needs to refresh
  private _onDidChangeTreeData = new vscode.EventEmitter<StagedFile | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  getChildren(element?: StagedFile): StagedFile[] {
    // Top level elements are the staged files themselves
    if (!element) {
      return this.files
    }
    // Staged files are leaves and have no children
    return []
  }

  /**
   * Maps a StagedFile data object to a VS Code TreeItem for display in the view.
   *
   * @param element The StagedFile to convert.
   * @returns A configured VS Code TreeItem.
   */
  getTreeItem(element: StagedFile): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label)
    // Use the URI as a stable ID for VS Code's view tracking
    item.id = element.uri.toString()

    // Assign a custom resource URI scheme to enable custom icon/theme handling by VS Code
    item.resourceUri = element.uri.with({ scheme: 'ai-stack' })

    const relativePath = vscode.workspace.asRelativePath(element.uri)
    // Extract the folder path to use as the TreeItem's description
    const folderPath = relativePath.substring(0, relativePath.lastIndexOf('/'))

    // Only set the description if it's a subfolder path and not the file itself (for root files)
    if (folderPath && folderPath !== relativePath) {
      item.description = folderPath
    }

    item.tooltip = element.uri.fsPath
    // A context value is used to enable/disable context menu commands conditionally
    item.contextValue = 'stagedFile'
    return item
  }

  /**
   * Adds a single file to the stack if it is not already present.
   */
  addFile(uri: vscode.Uri): void {
    const exists = this.files.some((f) => f.uri.toString() === uri.toString())

    if (!exists) {
      // Use the filename as the label, defaulting if parsing fails
      const label = uri.path.split('/').pop() || 'unknown'
      this.files.push({ uri, label })
      // Trigger a view refresh
      this._onDidChangeTreeData.fire()
    } else {
      vscode.window.setStatusBarMessage('File is already staged.', 2000)
    }
  }

  /**
   * Adds multiple files to the stack, filtering out duplicates.
   *
   * @param uris An array of URIs to add.
   */
  addFiles(uris: vscode.Uri[]): void {
    let addedCount = 0

    // Use a Set for fast checking of current staged files during iteration
    const currentStagedUris = new Set(this.files.map((f) => f.uri.toString()))

    uris.forEach((uri) => {
      const uriString = uri.toString()
      if (!currentStagedUris.has(uriString)) {
        const label = uri.path.split('/').pop() || 'unknown'
        this.files.push({ uri, label })
        currentStagedUris.add(uriString) // Add to set to prevent duplicates within the batch
        addedCount++
      }
    })

    if (addedCount > 0) {
      this._onDidChangeTreeData.fire()
    }
  }

  /**
   * Removes a single StagedFile object from the stack.
   *
   * @param file The StagedFile object to remove.
   */
  removeFile(file: StagedFile): void {
    this.files = this.files.filter((f) => f.uri.fsPath !== file.uri.fsPath)
    this._onDidChangeTreeData.fire()
  }

  /**
   * Removes multiple StagedFile objects from the stack in a single operation.
   *
   * @param filesToRemove An array of StagedFile objects.
   */
  removeFiles(filesToRemove: StagedFile[]): void {
    // Use a Set for O(1) removal lookup
    const pathsToRemove = new Set(filesToRemove.map((f) => f.uri.fsPath))
    this.files = this.files.filter((f) => !pathsToRemove.has(f.uri.fsPath))
    this._onDidChangeTreeData.fire()
  }

  /**
   * Clears the entire stack.
   */
  clear(): void {
    this.files = []
    this._onDidChangeTreeData.fire()
  }

  /**
   * Gets the current list of staged files.
   */
  getFiles(): StagedFile[] {
    return this.files
  }

  /**
   * Cleans up the internal EventEmitter.
   */
  public dispose() {
    this._onDidChangeTreeData.dispose()
    Logger.info('ContextStackProvider disposed: EventEmitter cleaned up.')
  }
}
