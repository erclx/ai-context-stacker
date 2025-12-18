import { TextDecoder } from 'util'
import * as vscode from 'vscode'

import { type StagedFile } from '../models'
import { categorizeTargets, handleFolderScanning, Logger, TokenEstimator } from '../utils'
import { IgnorePatternProvider } from './ignore-pattern-provider'

/**
 * Manages staged files, handles asynchronous token calculation,
 * and persists state across workspace reloads.
 */
export class ContextStackProvider
  implements vscode.TreeDataProvider<StagedFile>, vscode.TreeDragAndDropController<StagedFile>, vscode.Disposable
{
  public static readonly STORAGE_KEY = 'aiContextStacker.stagedUris'

  private files: StagedFile[] = []
  private _onDidChangeTreeData = new vscode.EventEmitter<StagedFile | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event
  readonly dragMimeTypes = []

  private readonly EMPTY_URI = vscode.Uri.parse('ai-stack:empty-drop-target')
  private readonly EMPTY_ID = 'emptyState'

  constructor(
    private context: vscode.ExtensionContext,
    private ignorePatternProvider: IgnorePatternProvider,
  ) {}

  get dropMimeTypes(): string[] {
    return ['text/uri-list', 'text/plain']
  }

  /**
   * Processes files dropped onto the view.
   * @param dataTransfer - VS Code transfer object.
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
   * Extracts URIs from transfer to support cross-platform drag interactions.
   */
  private async extractUrisFromTransfer(dataTransfer: vscode.DataTransfer): Promise<vscode.Uri[]> {
    const uriListItem = dataTransfer.get('text/uri-list')
    if (uriListItem) return this.parseUriList(await uriListItem.asString())

    const plainItem = dataTransfer.get('text/plain')
    if (plainItem) return this.parseUriList(await plainItem.asString())

    return []
  }

  /**
   * Parses newline-separated strings into URIs.
   */
  private parseUriList(content: string): vscode.Uri[] {
    return content
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => {
        try {
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
    if (element) return []
    if (this.files.length === 0) {
      return [{ uri: this.EMPTY_URI, label: 'Drag files here to start...' }]
    }
    return this.files
  }

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
    item.collapsibleState = vscode.TreeItemCollapsibleState.None
    return item
  }

  private createFileTreeItem(element: StagedFile): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label)
    item.resourceUri = element.uri
    item.iconPath = vscode.ThemeIcon.File
    item.tooltip = element.uri.fsPath
    item.contextValue = 'stagedFile'

    this.decorateTreeItem(item, element)
    return item
  }

  /**
   * Adds token stats and folder path to the tree item description.
   * Prioritizes token count visibility.
   */
  private decorateTreeItem(item: vscode.TreeItem, element: StagedFile): void {
    const relativePath = vscode.workspace.asRelativePath(element.uri)
    const folderPath = relativePath.substring(0, relativePath.lastIndexOf('/'))
    const parts: string[] = []

    // 1. Token Count (Primary)
    if (element.stats) {
      parts.push(`${this.formatTokenCount(element.stats.tokenCount)} tokens`)
    } else {
      parts.push('calculating...')
    }

    // 2. Folder Path (Secondary)
    if (folderPath && folderPath !== relativePath) {
      parts.push(folderPath)
    }

    item.description = parts.join(' • ')
  }

  /**
   * Formats numbers with 'k' shorthand and tilde for estimates.
   * e.g., 4500 -> "~4.5k", 300 -> "~300"
   */
  public formatTokenCount(count: number): string {
    const prefix = '~'
    if (count >= 1000) {
      return `${prefix}${(count / 1000).toFixed(1)}k`
    }
    return `${prefix}${count}`
  }

  /**
   * Adds files to the stack and triggers background token calculation.
   */
  addFiles(uris: vscode.Uri[]): void {
    const newFiles = this.filterNewFiles(uris)
    if (newFiles.length === 0) return

    this.files.push(...newFiles)
    this._onDidChangeTreeData.fire()
    this.persistState()

    // Non-blocking stats calculation
    this.enrichFileStats(newFiles)
  }

  private filterNewFiles(uris: vscode.Uri[]): StagedFile[] {
    const currentPaths = new Set(this.files.map((f) => f.uri.toString()))

    return uris
      .filter((uri) => !currentPaths.has(uri.toString()))
      .map((uri) => ({
        uri,
        label: uri.path.split('/').pop() || 'unknown',
      }))
  }

  /**
   * Reads file content and calculates tokens in the background.
   */
  private async enrichFileStats(targets: StagedFile[]): Promise<void> {
    const decoder = new TextDecoder()

    for (const file of targets) {
      try {
        const uint8Array = await vscode.workspace.fs.readFile(file.uri)
        const content = decoder.decode(uint8Array)
        const measurements = TokenEstimator.measure(content)

        file.stats = {
          tokenCount: measurements.tokenCount,
          charCount: content.length,
        }
      } catch (error) {
        Logger.warn(`Failed to read stats for ${file.uri.fsPath}`)
        file.stats = { tokenCount: 0, charCount: 0 }
      }
    }

    // Refresh UI once stats are ready
    this._onDidChangeTreeData.fire()
  }

  addFile(uri: vscode.Uri): void {
    this.addFiles([uri])
  }

  removeFile(file: StagedFile): void {
    this.files = this.files.filter((f) => f.uri.fsPath !== file.uri.fsPath)
    this._onDidChangeTreeData.fire()
    this.persistState()
  }

  removeFiles(filesToRemove: StagedFile[]): void {
    const pathsToRemove = new Set(filesToRemove.map((f) => f.uri.fsPath))
    this.files = this.files.filter((f) => !pathsToRemove.has(f.uri.fsPath))
    this._onDidChangeTreeData.fire()
    this.persistState()
  }

  clear(): void {
    this.files = []
    this._onDidChangeTreeData.fire()
    this.persistState()
  }

  getFiles(): StagedFile[] {
    return this.files
  }

  getTotalTokens(): number {
    return this.files.reduce((sum, file) => sum + (file.stats?.tokenCount ?? 0), 0)
  }

  /**
   * Serializes the current list of URIs to workspace state.
   */
  private persistState(): void {
    try {
      const uris = this.files.map((f) => f.uri.toString())
      this.context.workspaceState.update(ContextStackProvider.STORAGE_KEY, uris)
    } catch (error) {
      Logger.error('Failed to persist context stack state', error)
    }
  }

  dispose() {
    this._onDidChangeTreeData.dispose()
    Logger.info('ContextStackProvider disposed.')
  }
}
