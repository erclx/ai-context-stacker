import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile } from '../models'
import { AnalysisEngine, ContextKeyService, TokenAggregatorService, TreeBuilder } from '../services'
import { StackItemRenderer } from '../ui'
import { Logger } from '../utils'
import { IgnoreManager } from './ignore-manager'
import { TrackManager } from './track-manager'

export class StackProvider implements vscode.TreeDataProvider<StackTreeItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<StackTreeItem | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private disposables: vscode.Disposable[] = []

  private _cachedTree: StackTreeItem[] | undefined
  private _treeDirty = true
  private _showPinnedOnly = false

  private treeBuilder = new TreeBuilder()
  private renderer = new StackItemRenderer()

  constructor(
    private context: vscode.ExtensionContext,
    private ignoreManager: IgnoreManager,
    private trackManager: TrackManager,
    public readonly analysisEngine: AnalysisEngine,
    private tokenAggregator: TokenAggregatorService,
    private contextKeyService: ContextKeyService,
  ) {
    this.registerListeners()

    if (this.trackManager.isInitialized) {
      this.triggerRefresh()
      void this.analysisEngine.enrichActiveTrack()
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

  public getChildren(element?: StackTreeItem): StackTreeItem[] {
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
    return this.renderer.render(element, isBusy)
  }

  public getParent(): vscode.ProviderResult<StackTreeItem> {
    return undefined
  }

  public async addFile(uri: vscode.Uri): Promise<boolean> {
    return this.addFiles([uri])
  }

  public async addFiles(uris: vscode.Uri[]): Promise<boolean> {
    const newFiles = this.trackManager.addFilesToActive(uris)
    if (newFiles.length === 0) {
      return false
    }

    this._treeDirty = true
    this.triggerRefresh()

    this.analysisEngine.notifyFilesAdded()

    return true
  }

  public removeFiles(files: StagedFile[]): void {
    this.trackManager.removeFilesFromActive(files)
    this._treeDirty = true
    this.triggerRefresh()
  }

  public clear(): void {
    this.trackManager.clearActive()
    this._treeDirty = true
    this.triggerRefresh()
  }

  public async forceRefresh(): Promise<void> {
    const files = this.trackManager.getActiveTrack().files
    files.forEach((f) => (f.stats = undefined))
    this._treeDirty = true
    this.triggerRefresh()
    void this.analysisEngine.enrichActiveTrack()
  }

  public dispose(): void {
    this._onDidChangeTreeData.dispose()
    this.disposables.forEach((d) => d.dispose())
  }

  private shouldRebuildTree(): boolean {
    return this._treeDirty || !this._cachedTree
  }

  private triggerRefresh(): void {
    if (!this.trackManager.isInitialized) {
      return
    }

    this._onDidChangeTreeData.fire()
    this.refreshSmartVisibility()
  }

  private rebuildTreeCache(): StackTreeItem[] {
    const rebuildStart = Date.now()
    const files = this.getFiles()

    this.contextKeyService.updateStackState(this.trackManager.getActiveTrack().files)

    if (files.length === 0) {
      return this.handleEmptyTree()
    }

    this._cachedTree = this.executeTreeBuild(files)
    this._treeDirty = false

    const totalRebuildTime = Date.now() - rebuildStart
    Logger.debug(`Tree rebuild completed in ${totalRebuildTime}ms (${files.length} files)`)

    return this._cachedTree
  }

  private executeTreeBuild(files: StagedFile[]): StackTreeItem[] {
    const tree = this.treeBuilder.build(files)
    this.treeBuilder.calculateFolderStats(tree)
    this.postBuildUpdates(tree)
    return tree
  }

  private handleEmptyTree(): StackTreeItem[] {
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
      this._treeDirty = true
      this.triggerRefresh()
    })

    this.tokenAggregator.onDidChange(() => {
      if (this._cachedTree) {
        this.treeBuilder.calculateFolderStats(this._cachedTree)
      }
      this._onDidChangeTreeData.fire()
    })

    this.analysisEngine.onDidUpdateStats(() => {
      this._onDidChangeTreeData.fire()
    })

    this.disposables.push(vscode.workspace.onDidChangeConfiguration((e) => this.handleConfigChange(e)))
  }

  private handleConfigChange(e: vscode.ConfigurationChangeEvent): void {
    if (e.affectsConfiguration('aiContextStacker')) {
      this._treeDirty = true
      this.triggerRefresh()
    }
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
  }
}
