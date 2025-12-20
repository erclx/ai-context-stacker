import { TextDecoder } from 'util'
import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, type StagedFile, StagedFolder } from '../models'
import { categorizeTargets, handleFolderScanning, Logger, TokenEstimator } from '../utils'
import { ContextTrackManager } from './context-track-manager'
import { IgnorePatternProvider } from './ignore-pattern-provider'

/**
 * Acts as the ViewModel for the active track.
 * Handles rendering, coordinates token calculation, and visualizes "weight".
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

  /**
   * Transforms the flat list of StagedFiles into a hierarchical tree.
   */
  getChildren(element?: StackTreeItem): StackTreeItem[] {
    if (element) {
      // If folder, return its children. If file, it has no children.
      return isStagedFolder(element) ? element.children : []
    }

    const files = this.getFiles()
    if (files.length === 0) {
      return [this.createPlaceholderItem()]
    }

    return this.buildTree(files)
  }

  getTreeItem(element: StackTreeItem): vscode.TreeItem {
    if (isStagedFolder(element)) return this.createFolderTreeItem(element)
    if (element.uri.scheme === this.EMPTY_URI.scheme) return this.createEmptyTreeItem(element)
    return this.createFileTreeItem(element)
  }

  /**
   * Constructs a tree from flat files by analyzing relative paths.
   */
  private buildTree(files: StagedFile[]): StackTreeItem[] {
    const rootItems: StackTreeItem[] = []
    const folderMap = new Map<string, StagedFolder>()

    for (const file of files) {
      this.placeFileInTree(file, rootItems, folderMap)
    }

    return this.sortTree(rootItems)
  }

  /**
   * recursive helper to place a single file into the hierarchy.
   */
  private placeFileInTree(file: StagedFile, roots: StackTreeItem[], folderMap: Map<string, StagedFolder>) {
    const relativePath = vscode.workspace.asRelativePath(file.uri)
    const segments = relativePath.split('/')
    const isRootFile = segments.length === 1

    if (isRootFile) {
      roots.push(file)
      return
    }

    // It's in a folder; ensure the folder hierarchy exists
    let currentPath = ''
    let parentChildren = roots

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      currentPath = currentPath ? `${currentPath}/${segment}` : segment

      let folder = folderMap.get(currentPath)
      if (!folder) {
        folder = this.createVirtualFolder(segment, currentPath, file.uri)
        folderMap.set(currentPath, folder)
        parentChildren.push(folder)
      }

      // Add file to folder's recursive registry for command operations
      folder.containedFiles.push(file)
      parentChildren = folder.children
    }

    parentChildren.push(file)
  }

  private createVirtualFolder(name: string, id: string, sampleUri: vscode.Uri): StagedFolder {
    // Construct a URI for the folder based on the sample file's root
    const root = vscode.workspace.getWorkspaceFolder(sampleUri)
    const folderUri = root ? vscode.Uri.joinPath(root.uri, id) : sampleUri

    return {
      type: 'folder',
      id: `folder:${id}`,
      label: name,
      resourceUri: folderUri,
      children: [],
      containedFiles: [],
    }
  }

  private sortTree(items: StackTreeItem[]): StackTreeItem[] {
    return items.sort((a, b) => {
      // Folders first
      const aIsFolder = isStagedFolder(a)
      const bIsFolder = isStagedFolder(b)
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1

      // Then alphabetical
      return a.label.localeCompare(b.label)
    })
  }

  // --- Rendering Helpers ---

  private createFolderTreeItem(folder: StagedFolder): vscode.TreeItem {
    const item = new vscode.TreeItem(folder.label, vscode.TreeItemCollapsibleState.Expanded)
    item.contextValue = 'stagedFolder'
    item.iconPath = vscode.ThemeIcon.Folder
    item.resourceUri = folder.resourceUri

    // Aggregate tokens for description
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

  // --- Stats & Events ---

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

  private handleDocChange(doc: vscode.TextDocument, immediate = false) {
    const activeFiles = this.trackManager.getActiveTrack().files
    const targetFile = activeFiles.find((f) => f.uri.toString() === doc.uri.toString())
    if (!targetFile) return

    const key = doc.uri.toString()
    if (this.pendingUpdates.has(key)) clearTimeout(this.pendingUpdates.get(key)!)

    const updateLogic = () => {
      this.updateFileStats(targetFile, doc.getText())
      this.pendingUpdates.delete(key)
    }

    if (immediate) updateLogic()
    else this.pendingUpdates.set(key, setTimeout(updateLogic, this.DEBOUNCE_MS))
  }

  private updateFileStats(file: StagedFile, content: string) {
    try {
      const stats = TokenEstimator.measure(content)
      file.stats = { tokenCount: stats.tokenCount, charCount: content.length }
      this._onDidChangeTreeData.fire()
    } catch {
      Logger.warn(`Failed to update live stats for ${file.label}`)
    }
  }

  private refreshState(): void {
    this._onDidChangeTreeData.fire()
    this.enrichFileStats(this.getFiles())
  }

  // --- CRUD Operations ---

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

  // --- Drag & Drop ---

  async handleDrop(target: StackTreeItem | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    const uris = await this.extractUrisFromTransfer(dataTransfer)
    if (uris.length === 0) return

    const { files, folders } = await categorizeTargets(uris)
    if (files.length > 0) this.addFiles(files)
    if (folders.length > 0) await handleFolderScanning(folders, this, this.ignorePatternProvider)
  }

  private async extractUrisFromTransfer(dataTransfer: vscode.DataTransfer): Promise<vscode.Uri[]> {
    const item = dataTransfer.get('text/uri-list') || dataTransfer.get('text/plain')
    if (!item) return []
    const content = await item.asString()
    return content
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return l.startsWith('file:') || l.startsWith('vscode-remote:') ? vscode.Uri.parse(l) : vscode.Uri.file(l)
        } catch {
          return null
        }
      })
      .filter((u): u is vscode.Uri => u !== null)
  }

  // --- Async Stats ---

  private async enrichFileStats(targets: StagedFile[]): Promise<void> {
    const decoder = new TextDecoder()
    const filesToProcess = targets.filter((f) => !f.stats)
    if (filesToProcess.length === 0) return

    await Promise.all(
      filesToProcess.map(async (file) => {
        try {
          const u8 = await vscode.workspace.fs.readFile(file.uri)
          const isBinary = u8.slice(0, 512).some((b) => b === 0)
          if (isBinary) {
            file.isBinary = true
            file.stats = { tokenCount: 0, charCount: 0 }
          } else {
            file.isBinary = false
            const content = decoder.decode(u8)
            const stats = TokenEstimator.measure(content)
            file.stats = { tokenCount: stats.tokenCount, charCount: content.length }
          }
        } catch {
          /* ignore read errors */
        }
      }),
    )
    this._onDidChangeTreeData.fire()
  }

  dispose() {
    this._onDidChangeTreeData.dispose()
    this.disposables.forEach((d) => d.dispose())
  }
}
