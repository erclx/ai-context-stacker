import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile } from '../models'
import { StatsProcessor, TreeBuilder } from '../services'
import { StackItemRenderer } from '../ui'
import { Logger } from '../utils'
import { IgnoreManager } from './ignore-manager'
import { TrackManager } from './track-manager'

/**
 * The primary data provider for the "Context Stack" view in VS Code.
 * Orchestrates file tracking, tree generation, and statistics updates.
 */
export class StackProvider implements vscode.TreeDataProvider<StackTreeItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<StackTreeItem | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private readonly DEBOUNCE_MS = 400
  private readonly BATCH_WARNING_THRESHOLD = 200

  private pendingUpdates = new Map<string, ReturnType<typeof setTimeout>>()
  private disposables: vscode.Disposable[] = []

  private _cachedTree: StackTreeItem[] | undefined
  private _cachedTotalTokens = 0
  private _treeDirty = true
  private _showPinnedOnly = false

  private treeBuilder = new TreeBuilder()
  private statsProcessor = new StatsProcessor()
  private renderer = new StackItemRenderer()

  constructor(
    private extensionContext: vscode.ExtensionContext,
    private ignorePatternProvider: IgnoreManager,
    private trackManager: TrackManager,
  ) {
    this.registerListeners()
    this.rebuildCacheAndRefresh()
  }

  // --- Filtering API ---

  public get hasActiveFilters(): boolean {
    return this._showPinnedOnly
  }

  public togglePinnedOnly(): boolean {
    this._showPinnedOnly = !this._showPinnedOnly
    void vscode.commands.executeCommand('setContext', 'aiContextStacker.pinnedOnly', this._showPinnedOnly)

    this._treeDirty = true
    this.rebuildCacheAndRefresh()

    return this._showPinnedOnly
  }

  // --- Data Access ---

  public getFiles(): StagedFile[] {
    const rawFiles = this.trackManager.getActiveTrack().files
    if (!this.hasActiveFilters) {
      return rawFiles
    }
    return rawFiles.filter((f) => !this._showPinnedOnly || f.isPinned)
  }

  public getStackItem(uri: vscode.Uri): StackTreeItem | undefined {
    if (!this._cachedTree) {
      return undefined
    }
    return this.findRecursive(this._cachedTree, uri.toString())
  }

  public hasTrackedPath(uri: vscode.Uri): boolean {
    const targetStr = uri.toString()
    return this.trackManager.getActiveTrack().files.some((f) => {
      const fileStr = f.uri.toString()
      return fileStr === targetStr || fileStr.startsWith(targetStr + '/')
    })
  }

  public getActiveTrackName(): string {
    return this.trackManager.getActiveTrack().name
  }

  public getTotalTokens(): number {
    return this._cachedTotalTokens
  }

  public formatTokenCount(count: number): string {
    return this.renderer.formatTokenCount(count)
  }

  // --- Tree Construction ---

  public getChildren(element?: StackTreeItem): StackTreeItem[] {
    if (element && isStagedFolder(element)) {
      return element.children
    }
    if (this._cachedTree && !this._treeDirty) {
      return this._cachedTree
    }
    return this.rebuildTreeCache()
  }

  public getTreeItem(element: StackTreeItem): vscode.TreeItem {
    return this.renderer.render(element)
  }

  public getParent(element: StackTreeItem): vscode.ProviderResult<StackTreeItem> {
    return undefined
  }

  // --- CRUD Proxies ---

  public async addFiles(uris: vscode.Uri[]): Promise<boolean> {
    if (!(await this.confirmBatchOperation(uris.length))) {
      return false
    }

    const newFiles = this.trackManager.addFilesToActive(uris)
    if (newFiles.length === 0) {
      return false
    }

    this._treeDirty = true
    this.rebuildCacheAndRefresh()
    return true
  }

  public async addFile(uri: vscode.Uri): Promise<boolean> {
    return this.addFiles([uri])
  }

  public removeFiles(filesToRemove: StagedFile[]): void {
    this.trackManager.removeFilesFromActive(filesToRemove)
    this._treeDirty = true
    this.rebuildCacheAndRefresh()
  }

  public clear(): void {
    this.trackManager.clearActive()
    this._treeDirty = true
    this.rebuildCacheAndRefresh()
  }

  public dispose(): void {
    this._onDidChangeTreeData.dispose()
    this.disposables.forEach((d) => d.dispose())
    this.clearAllPendingTimers()
  }

  // --- Internal Implementation ---

  private rebuildCacheAndRefresh(): void {
    this.rebuildTreeCache()
    this._treeDirty = false
    this._onDidChangeTreeData.fire()
    void this.enrichStatsInBackground()
    this.updateEditorContext()
  }

  private rebuildTreeCache(): StackTreeItem[] {
    const rawFiles = this.trackManager.getActiveTrack().files
    this.syncContextKeys(rawFiles)
    this.resetPinFilterIfNeeded(rawFiles)

    const files = this.getFiles()
    if (files.length === 0) {
      this.updateContextKeys(false)
      this._cachedTree = this.generateEmptyState()
      return this._cachedTree
    }

    this._cachedTree = this.treeBuilder.build(files)
    this.updateContextKeys(this._cachedTree.some((i) => isStagedFolder(i)))
    this.recalculateTotalTokens()

    return this._cachedTree
  }

  private syncContextKeys(rawFiles: StagedFile[]): void {
    const hasPinnedFiles = rawFiles.some((f) => f.isPinned)
    const hasFiles = rawFiles.length > 0
    void vscode.commands.executeCommand('setContext', 'aiContextStacker.hasPinnedFiles', hasPinnedFiles)
    void vscode.commands.executeCommand('setContext', 'aiContextStacker.hasFiles', hasFiles)
  }

  private resetPinFilterIfNeeded(rawFiles: StagedFile[]): void {
    const hasPinnedFiles = rawFiles.some((f) => f.isPinned)
    if (this._showPinnedOnly && !hasPinnedFiles) {
      this._showPinnedOnly = false
      void vscode.commands.executeCommand('setContext', 'aiContextStacker.pinnedOnly', false)
    }
  }

  private generateEmptyState(): StackTreeItem[] {
    return [this.hasActiveFilters ? this.createNoMatchItem() : this.renderer.createPlaceholderItem()]
  }

  private findRecursive(nodes: StackTreeItem[], targetKey: string): StackTreeItem | undefined {
    for (const node of nodes) {
      if (this.nodeMatches(node, targetKey)) {
        return node
      }

      if (isStagedFolder(node)) {
        const found = this.findRecursive(node.children, targetKey)
        if (found) {
          return found
        }
      }
    }
    return undefined
  }

  private nodeMatches(node: StackTreeItem, targetKey: string): boolean {
    const uri = isStagedFolder(node) ? node.resourceUri : node.uri
    return uri.toString() === targetKey
  }

  private updateContextKeys(hasFolders: boolean): void {
    void vscode.commands.executeCommand('setContext', 'aiContextStacker.hasFolders', hasFolders)

    const allPaths = this._cachedTree ? this.collectAllPaths(this._cachedTree) : []
    void vscode.commands.executeCommand('setContext', 'aiContextStacker.stagedPaths', allPaths)
  }

  private collectAllPaths(nodes: StackTreeItem[]): string[] {
    const paths: string[] = []
    for (const node of nodes) {
      if (isStagedFolder(node)) {
        paths.push(node.resourceUri.fsPath)
        paths.push(...this.collectAllPaths(node.children))
      } else {
        paths.push(node.uri.fsPath)
      }
    }
    return paths
  }

  private createNoMatchItem(): StagedFile {
    return {
      type: 'file',
      uri: vscode.Uri.parse('ai-stack:no-match'),
      label: 'No files match your filter',
    }
  }

  private recalculateTotalTokens(): void {
    this._cachedTotalTokens = this.getFiles().reduce((sum, f) => sum + (f.stats?.tokenCount ?? 0), 0)
  }

  private async enrichStatsInBackground(): Promise<void> {
    try {
      await this.statsProcessor.enrichFileStats(this.getFiles())
      this.recalculateTotalTokens()
      this._onDidChangeTreeData.fire()
    } catch (error) {
      Logger.error('Failed to enrich file stats', error as Error)
    }
  }

  private registerListeners(): void {
    this.trackManager.onDidChangeTrack(() => {
      this._treeDirty = true
      this.rebuildCacheAndRefresh()
    })

    this.registerEditorListeners()
    this.registerWorkspaceListeners()
    this.updateEditorContext()
  }

  private registerEditorListeners(): void {
    vscode.window.onDidChangeActiveTextEditor(() => this.updateEditorContext(), null, this.disposables)
  }

  private registerWorkspaceListeners(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.handleDocChange(e.document)),
      vscode.workspace.onDidSaveTextDocument((doc) => this.handleDocChange(doc, true)),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('aiContextStacker')) {
          this._treeDirty = true
          this.rebuildCacheAndRefresh()
        }
      }),
    )
  }

  private updateEditorContext(): void {
    const editor = vscode.window.activeTextEditor

    const isTextEditor = !!editor
    void vscode.commands.executeCommand('setContext', 'aiContextStacker.isTextEditorActive', isTextEditor)

    let isCurrentFileStaged = false
    if (editor) {
      isCurrentFileStaged = this.hasTrackedPath(editor.document.uri)
    }
    void vscode.commands.executeCommand('setContext', 'aiContextStacker.isCurrentFileInStack', isCurrentFileStaged)
  }

  private handleDocChange(doc: vscode.TextDocument, immediate = false): void {
    const targetFile = this.findStagedFile(doc.uri)
    if (!targetFile) {
      return
    }
    this.scheduleStatsUpdate(doc, targetFile, immediate)
  }

  private scheduleStatsUpdate(doc: vscode.TextDocument, file: StagedFile, immediate: boolean): void {
    const key = doc.uri.toString()

    if (this.pendingUpdates.has(key)) {
      clearTimeout(this.pendingUpdates.get(key)!)
      this.pendingUpdates.delete(key)
    }

    if (immediate) {
      this.performStatsUpdate(doc, file)
      return
    }

    const timer = setTimeout(() => {
      this.performStatsUpdate(doc, file)
      this.pendingUpdates.delete(key)
    }, this.DEBOUNCE_MS)

    this.pendingUpdates.set(key, timer)
  }

  private performStatsUpdate(doc: vscode.TextDocument, file: StagedFile): void {
    try {
      const oldTokens = file.stats?.tokenCount ?? 0
      const newStats = this.statsProcessor.measure(doc.getText())

      file.stats = newStats
      const delta = newStats.tokenCount - oldTokens
      this._cachedTotalTokens += delta

      this._onDidChangeTreeData.fire(file)
    } catch (error) {
      Logger.warn(`Failed to update live stats for ${file.label}`)
    }
  }

  private findStagedFile(uri: vscode.Uri): StagedFile | undefined {
    return this.trackManager.getActiveTrack().files.find((f) => f.uri.toString() === uri.toString())
  }

  private async confirmBatchOperation(count: number): Promise<boolean> {
    if (count <= this.BATCH_WARNING_THRESHOLD) {
      return true
    }

    const result = await vscode.window.showWarningMessage(
      `You are adding ${count} files. This may affect performance.`,
      'Proceed',
      'Cancel',
    )
    return result === 'Proceed'
  }

  private clearAllPendingTimers(): void {
    this.pendingUpdates.forEach((timer) => clearTimeout(timer))
    this.pendingUpdates.clear()
  }
}
