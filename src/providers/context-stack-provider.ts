import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, type StagedFile, StagedFolder } from '../models'
import { StatsProcessor, TreeBuilder } from '../services'
import { categorizeTargets, handleFolderScanning, Logger } from '../utils'
import { extractUrisFromTransfer } from '../utils/drag-drop'
import { ContextTrackManager } from './context-track-manager'
import { IgnorePatternProvider } from './ignore-pattern-provider'

/**
 * Acts as the ViewModel for the active track.
 * Orchestrates tree building, stats updates, and UI events.
 */
export class ContextStackProvider
  implements vscode.TreeDataProvider<StackTreeItem>, vscode.TreeDragAndDropController<StackTreeItem>, vscode.Disposable
{
  private _onDidChangeTreeData = new vscode.EventEmitter<StackTreeItem | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  public readonly dragMimeTypes: readonly string[] = ['text/uri-list', 'text/plain']
  public readonly dropMimeTypes: readonly string[] = ['text/uri-list', 'text/plain']

  private readonly EMPTY_URI = vscode.Uri.parse('ai-stack:empty-drop-target')
  private readonly EMPTY_ID = 'emptyState'
  private readonly HIGH_TOKEN_THRESHOLD = 5000
  private readonly DEBOUNCE_MS = 400

  private pendingUpdates = new Map<string, NodeJS.Timeout>()
  private disposables: vscode.Disposable[] = []

  // Helpers
  private treeBuilder = new TreeBuilder()
  private statsProcessor = new StatsProcessor()

  constructor(
    private extensionContext: vscode.ExtensionContext,
    private ignorePatternProvider: IgnorePatternProvider,
    private trackManager: ContextTrackManager,
  ) {
    this.trackManager.onDidChangeTrack(() => this.refreshState())

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.handleDocChange(e.document)),
      vscode.workspace.onDidSaveTextDocument((doc) => this.handleDocChange(doc, true)),
    )
    this.refreshState()
  }

  getFiles(): StagedFile[] {
    return this.trackManager.getActiveTrack().files
  }

  getActiveTrackName(): string {
    return this.trackManager.getActiveTrack().name
  }

  getTotalTokens(): number {
    return this.getFiles().reduce((sum, file) => sum + (file.stats?.tokenCount ?? 0), 0)
  }

  // --- Tree Data Provider ---

  getChildren(element?: StackTreeItem): StackTreeItem[] {
    if (element) {
      return isStagedFolder(element) ? element.children : []
    }

    const files = this.getFiles()
    if (files.length === 0) {
      return [this.createPlaceholderItem()]
    }

    return this.treeBuilder.build(files)
  }

  getTreeItem(element: StackTreeItem): vscode.TreeItem {
    if (isStagedFolder(element)) return this.createFolderTreeItem(element)
    if (element.uri.scheme === this.EMPTY_URI.scheme) return this.createEmptyTreeItem(element)
    return this.createFileTreeItem(element)
  }

  getParent(element: StackTreeItem): vscode.ProviderResult<StackTreeItem> {
    return undefined
  }

  // --- UI Rendering ---

  private createFolderTreeItem(folder: StagedFolder): vscode.TreeItem {
    const item = new vscode.TreeItem(folder.label, vscode.TreeItemCollapsibleState.Expanded)
    item.contextValue = 'stagedFolder'
    item.iconPath = vscode.ThemeIcon.Folder
    item.resourceUri = folder.resourceUri

    const totalTokens = folder.containedFiles.reduce((sum, f) => sum + (f.stats?.tokenCount ?? 0), 0)
    item.description = this.formatTokenCount(totalTokens)
    item.tooltip = `${folder.containedFiles.length} files inside`

    return item
  }

  private createFileTreeItem(file: StagedFile): vscode.TreeItem {
    const item = new vscode.TreeItem(file.label)
    item.resourceUri = file.uri
    item.contextValue = file.isPinned ? 'stagedFile:pinned' : 'stagedFile'
    item.command = { command: 'vscode.open', title: 'Open File', arguments: [file.uri] }

    if (file.isBinary) {
      this.decorateBinaryItem(item, file)
      return item
    }

    const tokenCount = file.stats?.tokenCount ?? 0
    item.iconPath = file.isPinned
      ? new vscode.ThemeIcon('pin')
      : new vscode.ThemeIcon('file', this.getIconColor(tokenCount))

    const parts = [
      file.stats ? `${this.formatTokenCount(file.stats.tokenCount)}` : '...',
      file.isPinned ? '(Pinned)' : '',
    ]
    item.description = parts.filter(Boolean).join(' • ')

    return item
  }

  private createEmptyTreeItem(element: StagedFile): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label)
    item.iconPath = new vscode.ThemeIcon('cloud-upload')
    item.contextValue = this.EMPTY_ID
    item.command = {
      command: 'aiContextStacker.addFilePicker',
      title: 'Add Files',
    }
    return item
  }

  private createPlaceholderItem(): StagedFile {
    return {
      type: 'file',
      uri: this.EMPTY_URI,
      label: 'Drag files here to start...',
    }
  }

  private decorateBinaryItem(item: vscode.TreeItem, element: StagedFile) {
    item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('notificationsWarningIcon.foreground'))
    item.description = 'Binary'
    item.tooltip = 'Binary file detected.'
  }

  private getIconColor(tokenCount: number): vscode.ThemeColor | undefined {
    return tokenCount > this.HIGH_TOKEN_THRESHOLD ? new vscode.ThemeColor('charts.orange') : undefined
  }

  formatTokenCount(count: number): string {
    return count >= 1000 ? `~${(count / 1000).toFixed(1)}k` : `~${count}`
  }

  // --- Events & Updates ---

  private handleDocChange(doc: vscode.TextDocument, immediate = false) {
    const activeFiles = this.trackManager.getActiveTrack().files
    const targetFile = activeFiles.find((f) => f.uri.toString() === doc.uri.toString())
    if (!targetFile) return

    const key = doc.uri.toString()
    if (this.pendingUpdates.has(key)) clearTimeout(this.pendingUpdates.get(key)!)

    const updateLogic = () => {
      // Use StatsProcessor for the calculation
      try {
        const stats = this.statsProcessor.measure(doc.getText())
        targetFile.stats = stats
        this._onDidChangeTreeData.fire()
      } catch {
        Logger.warn(`Failed to update live stats for ${targetFile.label}`)
      }
      this.pendingUpdates.delete(key)
    }

    if (immediate) updateLogic()
    else this.pendingUpdates.set(key, setTimeout(updateLogic, this.DEBOUNCE_MS))
  }

  private refreshState(): void {
    this._onDidChangeTreeData.fire()
    // Delegate async enrichment to service
    this.statsProcessor.enrichFileStats(this.getFiles()).then(() => {
      this._onDidChangeTreeData.fire()
    })
  }

  // --- CRUD & Drag/Drop ---

  addFiles(uris: vscode.Uri[]): void {
    const newFiles = this.trackManager.addFilesToActive(uris)
    if (newFiles.length > 0) this.refreshState()
  }

  addFile(uri: vscode.Uri): void {
    this.addFiles([uri])
  }

  removeFiles(filesToRemove: StagedFile[]): void {
    this.trackManager.removeFilesFromActive(filesToRemove)
    this.refreshState()
  }

  clear(): void {
    this.trackManager.clearActive()
    this.refreshState()
  }

  async handleDrop(target: StackTreeItem | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    const uris = await extractUrisFromTransfer(dataTransfer)
    if (uris.length === 0) return

    const { files, folders } = await categorizeTargets(uris)
    if (files.length > 0) this.addFiles(files)
    if (folders.length > 0) await handleFolderScanning(folders, this, this.ignorePatternProvider)
  }

  dispose() {
    this._onDidChangeTreeData.dispose()
    this.disposables.forEach((d) => d.dispose())
  }
}
