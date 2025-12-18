import * as vscode from 'vscode'

import { type StagedFile } from '../models'
import { categorizeTargets, handleFolderScanning, Logger } from '../utils'
import { IgnorePatternProvider } from './ignore-pattern-provider'

/**
 * Manages the staged files state and handles the Virtual Drop Zone logic.
 */
export class ContextStackProvider
  implements vscode.TreeDataProvider<StagedFile>, vscode.TreeDragAndDropController<StagedFile>, vscode.Disposable
{
  private files: StagedFile[] = []
  private _onDidChangeTreeData = new vscode.EventEmitter<StagedFile | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event
  readonly dragMimeTypes = []

  private readonly EMPTY_URI = vscode.Uri.parse('ai-stack:empty-drop-target')
  private readonly EMPTY_ID = 'emptyState'

  constructor(private ignorePatternProvider: IgnorePatternProvider) {}

  get dropMimeTypes(): string[] {
    return ['text/uri-list', 'text/plain']
  }

  /**
   * Processes files dropped onto the view, categorizing them into files vs folders.
   * @param dataTransfer - VS Code transfer object containing the dropped resources.
   */
  async handleDrop(
    target: StagedFile | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken,
  ): Promise<void> {
    try {
      const uris = await this.extractUrisFromTransfer(dataTransfer)
      if (uris.length === 0) return

      const { files, folders } = await categorizeTargets(uris)

      if (files.length > 0) this.addFiles(files)
      if (folders.length > 0) await handleFolderScanning(folders, this, this.ignorePatternProvider)
    } catch (error) {
      Logger.error('Failed to handle drop', error)
    }
  }

  /**
   * Extracts URIs from multiple MIME types to support cross-platform drag interactions.
   */
  private async extractUrisFromTransfer(dataTransfer: vscode.DataTransfer): Promise<vscode.Uri[]> {
    const uriListItem = dataTransfer.get('text/uri-list')
    if (uriListItem) {
      const str = await uriListItem.asString()
      return this.parseUriList(str)
    }

    // Fallback for Linux/WSL where file drops often appear as raw text paths
    const plainItem = dataTransfer.get('text/plain')
    if (plainItem) {
      const str = await plainItem.asString()
      return this.parseUriList(str)
    }

    return []
  }

  /**
   * Parses newline-separated strings into strongly typed URIs.
   */
  private parseUriList(content: string): vscode.Uri[] {
    return content
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => {
        try {
          // Handle raw paths lacking a protocol scheme
          if (!line.startsWith('file:') && !line.startsWith('vscode-remote:')) {
            return vscode.Uri.file(line)
          }
          return vscode.Uri.parse(line)
        } catch {
          return null
        }
      })
      .filter((u): u is vscode.Uri => u !== null)
  }

  /**
   * Returns the staged files or a virtual placeholder if the stack is empty.
   */
  getChildren(element?: StagedFile): StagedFile[] {
    if (element) return []

    if (this.files.length === 0) {
      return [{ uri: this.EMPTY_URI, label: 'Drag files here to start...' }]
    }

    return this.files
  }

  /**
   * Generates the UI representation for a file or the virtual drop zone.
   */
  getTreeItem(element: StagedFile): vscode.TreeItem {
    if (element.uri.scheme === this.EMPTY_URI.scheme) {
      return this.createEmptyTreeItem(element)
    }
    return this.createFileTreeItem(element)
  }

  private createEmptyTreeItem(element: StagedFile): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label)
    item.iconPath = new vscode.ThemeIcon('cloud-upload')
    item.contextValue = this.EMPTY_ID
    // Prevent expansion since this is a leaf node placeholder
    item.collapsibleState = vscode.TreeItemCollapsibleState.None
    return item
  }

  private createFileTreeItem(element: StagedFile): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label)
    item.resourceUri = element.uri
    item.iconPath = vscode.ThemeIcon.File
    item.tooltip = element.uri.fsPath
    item.contextValue = 'stagedFile'

    this.addDescription(item, element.uri)
    return item
  }

  /**
   * Adds a folder path description if the file is not at the workspace root.
   */
  private addDescription(item: vscode.TreeItem, uri: vscode.Uri): void {
    const relativePath = vscode.workspace.asRelativePath(uri)
    const folderPath = relativePath.substring(0, relativePath.lastIndexOf('/'))

    if (folderPath && folderPath !== relativePath) {
      item.description = folderPath
    }
  }

  addFile(uri: vscode.Uri): void {
    const exists = this.files.some((f) => f.uri.toString() === uri.toString())
    if (!exists) {
      const label = uri.path.split('/').pop() || 'unknown'
      this.files.push({ uri, label })
      this._onDidChangeTreeData.fire()
    } else {
      vscode.window.setStatusBarMessage('File is already staged.', 2000)
    }
  }

  /**
   * Batch adds files while filtering out duplicates.
   */
  addFiles(uris: vscode.Uri[]): void {
    let addedCount = 0
    const currentStagedUris = new Set(this.files.map((f) => f.uri.toString()))

    uris.forEach((uri) => {
      const uriString = uri.toString()
      if (!currentStagedUris.has(uriString)) {
        const label = uri.path.split('/').pop() || 'unknown'
        this.files.push({ uri, label })
        currentStagedUris.add(uriString)
        addedCount++
      }
    })

    if (addedCount > 0) this._onDidChangeTreeData.fire()
  }

  removeFile(file: StagedFile): void {
    this.files = this.files.filter((f) => f.uri.fsPath !== file.uri.fsPath)
    this._onDidChangeTreeData.fire()
  }

  /**
   * Efficiently removes a batch of files using a Set lookup.
   */
  removeFiles(filesToRemove: StagedFile[]): void {
    const pathsToRemove = new Set(filesToRemove.map((f) => f.uri.fsPath))
    this.files = this.files.filter((f) => !pathsToRemove.has(f.uri.fsPath))
    this._onDidChangeTreeData.fire()
  }

  clear(): void {
    this.files = []
    this._onDidChangeTreeData.fire()
  }

  getFiles(): StagedFile[] {
    return this.files
  }

  dispose() {
    this._onDidChangeTreeData.dispose()
    Logger.info('ContextStackProvider disposed.')
  }
}
