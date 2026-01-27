import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile } from '../models'
import { AnalysisEngine, ContextKeyService, TokenAggregatorService, TreeBuilder } from '../services'
import { StackItemRenderer } from '../ui'
import { collectFilesFromFolders, Logger, resolveScanRoots } from '../utils'
import { IgnoreManager } from './ignore-manager'
import { TrackManager } from './track-manager'

export class StackProvider implements vscode.TreeDataProvider<StackTreeItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<StackTreeItem | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private disposables: vscode.Disposable[] = []

  private _cachedTree: StackTreeItem[] | undefined
  private _treeDirty = true
  private _showPinnedOnly = false
  private _largeFileThreshold = 5000

  private renderer = new StackItemRenderer()
  private enrichmentCTS: vscode.CancellationTokenSource | undefined
  private refreshTimer: NodeJS.Timeout | undefined
  private structuralRefreshTimer: NodeJS.Timeout | undefined

  private readonly STRUCTURAL_REFRESH_DELAY = 150
  private readonly STANDARD_REFRESH_DELAY = 50

  constructor(
    private context: vscode.ExtensionContext,
    private ignoreManager: IgnoreManager,
    private trackManager: TrackManager,
    private treeBuilder: TreeBuilder,
    public readonly analysisEngine: AnalysisEngine,
    private tokenAggregator: TokenAggregatorService,
    private contextKeyService: ContextKeyService,
  ) {
    this.refreshConfigCache()
    this.registerListeners()

    if (this.trackManager.isInitialized) {
      this.triggerRefresh()
      this.triggerEnrichment()
    }
  }

  public get hasActiveFilters(): boolean {
    return this._showPinnedOnly
  }

  public togglePinnedOnly(): boolean {
    this._showPinnedOnly = !this._showPinnedOnly
    this.contextKeyService.updatePinnedFilter(this._showPinnedOnly)
    this._treeDirty = true
    this.triggerRefresh()
    return this._showPinnedOnly
  }

  public resort(): void {
    if (this.hasActiveFilters) {
      this._treeDirty = true
      this.triggerRefresh()
      return
    }

    if (this._cachedTree) {
      this.treeBuilder.resort()
      this._onDidChangeTreeData.fire()
    }
  }

  public getFiles(): StagedFile[] {
    const raw = this.trackManager.getActiveTrack().files
    return this._showPinnedOnly ? raw.filter((f) => f.isPinned) : raw
  }

  public getStackItem(uri: vscode.Uri): StackTreeItem | undefined {
    return this._cachedTree ? this.findRecursive(this._cachedTree, uri.toString()) : undefined
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
    return this.tokenAggregator.totalTokens
  }

  public formatTokenCount(count: number): string {
    return this.tokenAggregator.format(count)
  }

  public getChildren(element?: StackTreeItem): vscode.ProviderResult<StackTreeItem[]> {
    if (element && isStagedFolder(element)) {
      return element.children
    }
    if (this.shouldRebuildTree()) {
      return this.rebuildTreeCache()
    }
    return this._cachedTree ?? []
  }

  public getTreeItem(element: StackTreeItem): vscode.TreeItem {
    const isBusy = this.analysisEngine.isWarmingUp || this.analysisEngine.isAnalyzing
    return this.renderer.render(element, isBusy, this._largeFileThreshold)
  }

  public getParent(): vscode.ProviderResult<StackTreeItem> {
    return undefined
  }

  public async addFile(uri: vscode.Uri): Promise<boolean> {
    return this.addFiles([uri])
  }

  public async addFiles(uris: vscode.Uri[]): Promise<boolean> {
    const newFiles = this.trackManager.addFilesToActive(uris)

    if (newFiles.length === 0) return false

    if (this.canPerformOptimisticPatch()) {
      this._cachedTree = await this.treeBuilder.patch(newFiles, [])
      this.postBuildUpdates(this._cachedTree)
      this._onDidChangeTreeData.fire()
    } else {
      this._treeDirty = true
      this.triggerRefresh()
    }

    this.triggerEnrichment()
    return true
  }

  public async removeFiles(files: StagedFile[]): Promise<void> {
    this.trackManager.removeFilesFromActive(files)

    if (this.canPerformOptimisticPatch()) {
      this._cachedTree = await this.treeBuilder.patch([], files)
      this.handlePostPatchUpdate()
    } else {
      this._treeDirty = true
      this.triggerRefresh()
    }

    this.triggerEnrichment()
  }

  public clear(): void {
    this.trackManager.clearActive()
    this.treeBuilder.reset()
    this._treeDirty = true
    this.triggerRefresh()
  }

  public async forceRefresh(): Promise<void> {
    const files = this.trackManager.getActiveTrack().files
    files.forEach((f) => (f.stats = undefined))
    this._treeDirty = true
    this.triggerRefresh()
    this.triggerEnrichment()
  }

  public async reScanFileSystem(): Promise<void> {
    const currentFiles = this.getFiles()
    if (currentFiles.length === 0) {
      return this.forceRefresh()
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Syncing stack with file system...',
        cancellable: true,
      },
      async (_, token) => {
        const scanRoots = resolveScanRoots(currentFiles.map((f) => f.uri))

        const foundUris = await collectFilesFromFolders(scanRoots, this.ignoreManager, token)

        if (token.isCancellationRequested) return

        const currentSet = new Set(currentFiles.map((f) => f.uri.toString()))
        const newUris = foundUris.filter((uri) => !currentSet.has(uri.toString()))

        if (newUris.length > 0) {
          this.addFiles(newUris)
          vscode.window.setStatusBarMessage(`Found ${newUris.length} new files.`, 3000)
        } else {
          vscode.window.setStatusBarMessage('No new files found.', 3000)
        }
      },
    )
  }

  public dispose(): void {
    this.cancelEnrichment()
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }
    if (this.structuralRefreshTimer) {
      clearTimeout(this.structuralRefreshTimer)
    }
    this._onDidChangeTreeData.dispose()
    this.disposables.forEach((d) => d.dispose())
  }

  private triggerEnrichment(): void {
    this.cancelEnrichment()
    this.enrichmentCTS = new vscode.CancellationTokenSource()

    void this.analysisEngine.enrichActiveTrack(this.enrichmentCTS.token)
  }

  private cancelEnrichment(): void {
    if (this.enrichmentCTS) {
      this.enrichmentCTS.cancel()
      this.enrichmentCTS.dispose()
      this.enrichmentCTS = undefined
    }
  }

  private shouldRebuildTree(): boolean {
    return this._treeDirty || !this._cachedTree
  }

  private triggerRefresh(): void {
    if (!this.trackManager.isInitialized) return
    if (this.refreshTimer) return

    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined
      this.fireRefresh()
    }, this.STANDARD_REFRESH_DELAY)
  }

  private triggerStructuralRefresh(): void {
    if (!this.trackManager.isInitialized) return

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = undefined
    }

    if (this.structuralRefreshTimer) return

    this.structuralRefreshTimer = setTimeout(() => {
      this.structuralRefreshTimer = undefined
      this.fireRefresh()
    }, this.STRUCTURAL_REFRESH_DELAY)
  }

  private fireRefresh(): void {
    this._onDidChangeTreeData.fire()
    this.refreshSmartVisibility()
    this.checkUnstagedOpenFiles()
  }

  private async rebuildTreeCache(): Promise<StackTreeItem[]> {
    const rebuildStart = Date.now()
    const files = this.getFiles()

    this.contextKeyService.updateStackState(this.trackManager.getActiveTrack().files)

    if (files.length === 0) {
      return this.handleEmptyTree()
    }

    this._cachedTree = await this.executeTreeBuild(files)
    this._treeDirty = false

    const totalRebuildTime = Date.now() - rebuildStart
    Logger.debug(`Tree rebuild completed in ${totalRebuildTime}ms (${files.length} files)`)

    return this._cachedTree
  }

  private async executeTreeBuild(files: StagedFile[]): Promise<StackTreeItem[]> {
    const tree = await this.treeBuilder.buildAsync(files)
    this.postBuildUpdates(tree)
    return tree
  }

  private handleEmptyTree(): StackTreeItem[] {
    this.contextKeyService.updateFolderState(false)
    this.treeBuilder.reset()

    this._cachedTree = this.generateEmptyState()
    this._treeDirty = false
    return this._cachedTree
  }

  private postBuildUpdates(tree: StackTreeItem[]): void {
    const hasFolders = tree.some((i) => isStagedFolder(i))
    this.contextKeyService.updateFolderState(hasFolders)
  }

  private generateEmptyState(): StackTreeItem[] {
    if (this._showPinnedOnly) {
      return [
        {
          type: 'file',
          uri: vscode.Uri.parse('ai-stack:no-match'),
          label: 'No files match your filter',
        },
      ]
    }
    return [this.renderer.createPlaceholderItem()]
  }

  private registerListeners(): void {
    this.trackManager.onDidChangeTrack(() => {
      this._cachedTree = undefined
      this._treeDirty = true
      this.treeBuilder.reset()
      this.triggerRefresh()
      this.triggerEnrichment()
    })

    this.tokenAggregator.onDidChange(() => {
      this.treeBuilder.recalculateAllStats()
      this._onDidChangeTreeData.fire()
    })

    this.analysisEngine.onDidUpdateStats(() => {
      this.treeBuilder.recalculateAllStats()
      this._onDidChangeTreeData.fire()
    })

    this.disposables.push(vscode.workspace.onDidChangeConfiguration((e) => this.handleConfigChange(e)))
    this.disposables.push(vscode.window.onDidChangeActiveTextEditor(() => this.refreshSmartVisibility()))
    this.disposables.push(vscode.window.tabGroups.onDidChangeTabs(() => this.checkUnstagedOpenFiles()))
  }

  private handleConfigChange(e: vscode.ConfigurationChangeEvent): void {
    if (e.affectsConfiguration('aiContextStacker')) {
      this.refreshConfigCache()
      this._treeDirty = true
      this.triggerRefresh()
    }
  }

  private refreshConfigCache(): void {
    this._largeFileThreshold = vscode.workspace
      .getConfiguration('aiContextStacker')
      .get<number>('largeFileThreshold', 5000)
  }

  private findRecursive(nodes: StackTreeItem[], targetKey: string): StackTreeItem | undefined {
    for (const node of nodes) {
      const uri = isStagedFolder(node) ? node.resourceUri : node.uri
      if (uri.toString() === targetKey) {
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

  private refreshSmartVisibility(): void {
    this.contextKeyService.updateEditorState()

    const editor = vscode.window.activeTextEditor
    if (editor) {
      const isStaged = this.hasTrackedPath(editor.document.uri)
      this.contextKeyService.updateEditorContext(editor.document.uri, isStaged)
    } else {
      this.contextKeyService.updateEditorContext(undefined, false)
    }
  }

  private checkUnstagedOpenFiles(): void {
    const stagedSet = new Set(this.trackManager.getActiveTrack().files.map((f) => f.uri.toString()))
    let hasUnstaged = false

    outerLoop: for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (tab.input instanceof vscode.TabInputText) {
          if (!stagedSet.has(tab.input.uri.toString())) {
            hasUnstaged = true
            break outerLoop
          }
        }
      }
    }

    this.contextKeyService.updateUnstagedFilesState(hasUnstaged)
  }

  private canPerformOptimisticPatch(): boolean {
    return !!(this._cachedTree && !this._treeDirty && !this.hasActiveFilters)
  }

  private handlePostPatchUpdate(): void {
    if (this._cachedTree && this._cachedTree.length === 0) {
      this._cachedTree = undefined
      this._treeDirty = true
      this.triggerRefresh()
    } else if (this._cachedTree) {
      this.postBuildUpdates(this._cachedTree)
      this._onDidChangeTreeData.fire()
    }
  }
}
