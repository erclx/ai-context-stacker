import * as vscode from 'vscode'

import { type StagedFile } from '../models'
import { Logger } from '../utils'
import { categorizeTargets, handleFolderScanning } from '../utils'
import { IgnorePatternProvider } from './ignore-pattern-provider'

/**
 * Manages the state of staged files and handles Drag & Drop interactions.
 * Acts as the bridge between the Tree View UI and the file system.
 */
export class ContextStackProvider
  implements vscode.TreeDataProvider<StagedFile>, vscode.TreeDragAndDropController<StagedFile>, vscode.Disposable
{
  private files: StagedFile[] = []
  private _onDidChangeTreeData = new vscode.EventEmitter<StagedFile | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event
  readonly dragMimeTypes = []

  constructor(private ignorePatternProvider: IgnorePatternProvider) {}

  get dropMimeTypes(): string[] {
    return [
      'text/uri-list',
      'text/plain',
      'application/vnd.code.tree.testViewDragAndDrop',
      'application/vnd.code.tree.explorer',
      'application/octet-stream',
    ]
  }

  /**
   * Handles files dropped onto the TreeView from internal or external sources.
   * @param dataTransfer VS Code data transfer object containing dropped items
   */
  async handleDrop(
    target: StagedFile | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken,
  ): Promise<void> {
    let uris: vscode.Uri[] = []

    const uriListItem = dataTransfer.get('text/uri-list')
    if (uriListItem) {
      const str = await uriListItem.asString()
      uris = this.parseUriList(str)
    }

    // Fallback for Linux/WSL environments where drops often provide raw paths via text/plain
    if (uris.length === 0) {
      const plainItem = dataTransfer.get('text/plain')
      if (plainItem) {
        const str = await plainItem.asString()
        uris = this.parseUriList(str)
      }
    }

    if (uris.length === 0) return

    const { files, folders } = await categorizeTargets(uris)

    if (files.length > 0) this.addFiles(files)
    if (folders.length > 0) await handleFolderScanning(folders, this, this.ignorePatternProvider)
  }

  /**
   * Safely parses newline-separated URI strings or raw paths into Uri objects.
   */
  private parseUriList(content: string): vscode.Uri[] {
    return content
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => {
        try {
          // Manual schema detection for environments that drop raw file paths without a protocol
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

  getChildren(element?: StagedFile): StagedFile[] {
    return element ? [] : this.files
  }

  getTreeItem(element: StagedFile): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label)
    item.resourceUri = element.uri

    item.iconPath = vscode.ThemeIcon.File

    const relativePath = vscode.workspace.asRelativePath(element.uri)
    const folderPath = relativePath.substring(0, relativePath.lastIndexOf('/'))

    if (folderPath && folderPath !== relativePath) {
      item.description = folderPath
    }

    item.tooltip = element.uri.fsPath
    item.contextValue = 'stagedFile'
    return item
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
   * Batch adds multiple URIs to the provider state while preventing duplicates.
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
   * Efficiently removes multiple files using a Set for path lookup.
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

  public dispose() {
    this._onDidChangeTreeData.dispose()
    Logger.info('ContextStackProvider disposed.')
  }
}
