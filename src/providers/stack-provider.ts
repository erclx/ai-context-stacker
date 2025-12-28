import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile } from '../models'
import { StatsProcessor, TreeBuilder } from '../services'
import { StackItemRenderer } from '../ui'
import { Logger } from '../utils'
import { IgnoreManager } from './ignore-manager'
import { TrackManager } from './track-manager'

class ContextKeyBatcher {
  private pending = new Map<string, unknown>()
  private timer: NodeJS.Timeout | undefined

  public set(key: string, value: unknown): void {
    this.pending.set(key, value)
    this.scheduleFlush()
  }

  private scheduleFlush(): void {
    if (this.timer) return
    this.timer = setTimeout(() => this.flush(), 50)
  }

  private flush(): void {
    this.timer = undefined
    this.pending.forEach((val, key) => {
      void vscode.commands.executeCommand('setContext', key, val)
    })
    this.pending.clear()
  }
}

export class StackProvider implements vscode.TreeDataProvider<StackTreeItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<StackTreeItem | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private readonly DEBOUNCE_MS = 400
  private pendingUpdates = new Map<string, NodeJS.Timeout>()
  private disposables: vscode.Disposable[] = []

  private _cachedTree: StackTreeItem[] | undefined
  private _cachedTotalTokens = 0
  private _treeDirty = true
  private _showPinnedOnly = false
  private _isWarmingUp = true

  private treeBuilder = new TreeBuilder()
  private statsProcessor = new StatsProcessor()
  private renderer = new StackItemRenderer()
  private contextBatcher = new ContextKeyBatcher()

  constructor(
    private context: vscode.ExtensionContext,
    private ignoreManager: IgnoreManager,
    private trackManager: TrackManager,
  ) {
    this.registerListeners()
    this.initializeWarmup()
  }

  public get hasActiveFilters(): boolean {
    return this._showPinnedOnly
  }

  public togglePinnedOnly(): boolean {
    this._showPinnedOnly = !this._showPinnedOnly
    this.contextBatcher.set('aiContextStacker.pinnedOnly', this._showPinnedOnly)
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
    return this._cachedTotalTokens
  }

  public formatTokenCount(count: number): string {
    return this.renderer.formatTokenCount(count)
  }

  public getChildren(element?: StackTreeItem): StackTreeItem[] {
    if (element && isStagedFolder(element)) return element.children
    if (this.shouldRebuildTree()) return this.rebuildTreeCache()
    return this._cachedTree ?? []
  }

  public getTreeItem(element: StackTreeItem): vscode.TreeItem {
    return this.renderer.render(element, this._isWarmingUp)
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

    this._treeDirty = true
    this.triggerRefresh()
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
  }

  public dispose(): void {
    this._onDidChangeTreeData.dispose()
    this.disposables.forEach((d) => d.dispose())
    this.clearAllPendingTimers()
    this.statsProcessor.dispose()
  }

  private initializeWarmup(): void {
    this.statsProcessor.onDidWarmup(() => {
      this._isWarmingUp = false
      this.triggerRefresh()
    })
  }

  private shouldRebuildTree(): boolean {
    return this._treeDirty || !this._cachedTree
  }

  private triggerRefresh(): void {
    this._onDidChangeTreeData.fire()
    void this.enrichStatsInBackground()
    this.refreshSmartVisibility()
  }

  private rebuildTreeCache(): StackTreeItem[] {
    const rawFiles = this.trackManager.getActiveTrack().files
    this.syncFastContextKeys(rawFiles)

    const files = this.getFiles()
    if (files.length === 0) return this.handleEmptyTree()

    this._cachedTree = this.treeBuilder.build(files)

    this.treeBuilder.calculateFolderStats(this._cachedTree)

    this._treeDirty = false

    this.postBuildUpdates()
    return this._cachedTree
  }

  private handleEmptyTree(): StackTreeItem[] {
    this._cachedTree = this.generateEmptyState()
    this._treeDirty = false
    return this._cachedTree
  }

  private postBuildUpdates(): void {
    const hasFolders = this._cachedTree!.some((i) => isStagedFolder(i))
    this.contextBatcher.set('aiContextStacker.hasFolders', hasFolders)
    this.recalculateTotalTokens()
  }

  private syncFastContextKeys(rawFiles: StagedFile[]): void {
    this.contextBatcher.set(
      'aiContextStacker.hasPinnedFiles',
      rawFiles.some((f) => f.isPinned),
    )
    this.contextBatcher.set('aiContextStacker.hasFiles', rawFiles.length > 0)
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

  private recalculateTotalTokens(): void {
    const files = this.getFiles()
    this._cachedTotalTokens = files.reduce((sum, f) => sum + (f.stats?.tokenCount ?? 0), 0)
  }

  private async enrichStatsInBackground(): Promise<void> {
    try {
      const files = this.getFiles()
      await this.statsProcessor.enrichFileStats(files)

      this.recalculateTotalTokens()

      if (this._cachedTree) {
        this.treeBuilder.calculateFolderStats(this._cachedTree)
      }

      this._onDidChangeTreeData.fire()
    } catch (error) {
      Logger.error('Stats enrichment failed', error as Error)
    }
  }

  private registerListeners(): void {
    this.trackManager.onDidChangeTrack(() => {
      this._treeDirty = true
      this.triggerRefresh()
    })

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.handleDocChange(e.document)),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('aiContextStacker')) {
          this._treeDirty = true
          this.triggerRefresh()
        }
      }),
    )
  }

  private handleDocChange(doc: vscode.TextDocument): void {
    const files = this.trackManager.getActiveTrack().files
    const target = files.find((f) => f.uri.toString() === doc.uri.toString())
    if (target) this.scheduleStatsUpdate(doc, target)
  }

  private scheduleStatsUpdate(doc: vscode.TextDocument, file: StagedFile): void {
    const key = doc.uri.toString()
    if (this.pendingUpdates.has(key)) clearTimeout(this.pendingUpdates.get(key)!)

    const timer = setTimeout(() => this.performStatsUpdate(doc, file), this.DEBOUNCE_MS)
    this.pendingUpdates.set(key, timer)
  }

  private performStatsUpdate(doc: vscode.TextDocument, file: StagedFile): void {
    file.stats = this.statsProcessor.measure(doc.getText())

    this.recalculateTotalTokens()

    if (this._cachedTree) {
      this.treeBuilder.calculateFolderStats(this._cachedTree)
    }

    this._onDidChangeTreeData.fire()
    this.pendingUpdates.delete(doc.uri.toString())
  }

  private findRecursive(nodes: StackTreeItem[], targetKey: string): StackTreeItem | undefined {
    for (const node of nodes) {
      const uri = isStagedFolder(node) ? node.resourceUri : node.uri
      if (uri.toString() === targetKey) return node

      if (isStagedFolder(node)) {
        const found = this.findRecursive(node.children, targetKey)
        if (found) return found
      }
    }
    return undefined
  }

  private refreshSmartVisibility(): void {
    this.contextBatcher.set('aiContextStacker.isTextEditorActive', !!vscode.window.activeTextEditor)
  }

  private clearAllPendingTimers(): void {
    this.pendingUpdates.forEach(clearTimeout)
    this.pendingUpdates.clear()
  }
}
