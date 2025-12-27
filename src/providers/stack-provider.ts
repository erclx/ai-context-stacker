import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile } from '../models'
import { StatsProcessor, TreeBuilder } from '../services'
import { StackItemRenderer } from '../ui'
import { Logger } from '../utils'
import { IgnoreManager } from './ignore-manager'
import { TrackManager } from './track-manager'

export class StackProvider implements vscode.TreeDataProvider<StackTreeItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<StackTreeItem | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private readonly DEBOUNCE_MS = 400
  private readonly BATCH_WARNING = 200

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

  constructor(
    private extensionContext: vscode.ExtensionContext,
    private ignorePatternProvider: IgnoreManager,
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
    this.updateCriticalContext('aiContextStacker.pinnedOnly', this._showPinnedOnly)
    this._treeDirty = true
    this.triggerRefresh()
    return this._showPinnedOnly
  }

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
    return this.renderer.render(element, this._isWarmingUp)
  }

  public getParent(): vscode.ProviderResult<StackTreeItem> {
    return undefined
  }

  public async addFiles(uris: vscode.Uri[]): Promise<boolean> {
    if (!(await this.confirmBatchOperation(uris.length))) {
      return false
    }

    const newFiles = this.trackManager.addFilesToActive(uris)
    if (newFiles.length === 0) return false

    this._treeDirty = true
    this.triggerRefresh()
    return true
  }

  public async addFile(uri: vscode.Uri): Promise<boolean> {
    return this.addFiles([uri])
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
  }

  private initializeWarmup(): void {
    this.statsProcessor.onDidWarmup(() => {
      this._isWarmingUp = false
      this.triggerRefresh()
    })

    void vscode.window.withProgress(
      { location: { viewId: 'aiContextStackerView' } },
      () =>
        new Promise<void>((resolve) => {
          const d = this.statsProcessor.onDidWarmup(() => {
            d.dispose()
            resolve()
          })
        }),
    )
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
    this.resetPinFilterIfNeeded(rawFiles)

    const files = this.getFiles()
    if (files.length === 0) {
      return this.handleEmptyTree()
    }

    this._cachedTree = this.treeBuilder.build(files)
    this._treeDirty = false

    this.postBuildUpdates()
    return this._cachedTree
  }

  private handleEmptyTree(): StackTreeItem[] {
    this.updateAuxiliaryContextKeys(false)
    this._cachedTree = this.generateEmptyState()
    this._treeDirty = false
    return this._cachedTree
  }

  private postBuildUpdates(): void {
    const hasFolders = this._cachedTree!.some((i) => isStagedFolder(i))
    this.updateCriticalContext('aiContextStacker.hasFolders', hasFolders)
    setTimeout(() => this.updateAuxiliaryContextKeys(hasFolders), 0)
    this.recalculateTotalTokens()
  }

  private syncFastContextKeys(rawFiles: StagedFile[]): void {
    const hasPinned = rawFiles.some((f) => f.isPinned)
    const hasFiles = rawFiles.length > 0

    this.updateCriticalContext('aiContextStacker.hasPinnedFiles', hasPinned)
    this.updateCriticalContext('aiContextStacker.hasFiles', hasFiles)
  }

  private updateAuxiliaryContextKeys(hasFolders: boolean): void {
    if (!this._cachedTree) return
    const allPaths = this.collectAllPaths(this._cachedTree)
    void vscode.commands.executeCommand('setContext', 'aiContextStacker.stagedPaths', allPaths)
  }

  private updateCriticalContext(key: string, value: unknown): void {
    void vscode.commands.executeCommand('setContext', key, value)
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

  private generateEmptyState(): StackTreeItem[] {
    return [this.hasActiveFilters ? this.createNoMatchItem() : this.renderer.createPlaceholderItem()]
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
      Logger.error('Stats enrichment failed', error as Error)
    }
  }

  private registerListeners(): void {
    this.trackManager.onDidChangeTrack(() => {
      this._treeDirty = true
      this.triggerRefresh()
    })

    this.registerWorkspaceListeners()
    this.refreshSmartVisibility()
  }

  private registerWorkspaceListeners(): void {
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
    const targetFile = this.getFiles().find((f) => f.uri.toString() === doc.uri.toString())
    if (targetFile) {
      this.scheduleStatsUpdate(doc, targetFile)
    }
  }

  private scheduleStatsUpdate(doc: vscode.TextDocument, file: StagedFile): void {
    const key = doc.uri.toString()
    if (this.pendingUpdates.has(key)) {
      clearTimeout(this.pendingUpdates.get(key)!)
    }

    const timer = setTimeout(() => this.performStatsUpdate(doc, file), this.DEBOUNCE_MS)
    this.pendingUpdates.set(key, timer)
  }

  private performStatsUpdate(doc: vscode.TextDocument, file: StagedFile): void {
    file.stats = this.statsProcessor.measure(doc.getText())
    this.recalculateTotalTokens()
    this._onDidChangeTreeData.fire(file)
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

  private createNoMatchItem(): StagedFile {
    return {
      type: 'file',
      uri: vscode.Uri.parse('ai-stack:no-match'),
      label: 'No files match your filter',
    }
  }

  private async confirmBatchOperation(count: number): Promise<boolean> {
    if (count <= this.BATCH_WARNING) return true

    const choice = await vscode.window.showWarningMessage(
      `Adding ${count} files may impact performance.`,
      'Proceed',
      'Cancel',
    )
    return choice === 'Proceed'
  }

  private resetPinFilterIfNeeded(rawFiles: StagedFile[]): void {
    const hasPinnedFiles = rawFiles.some((f) => f.isPinned)
    if (this._showPinnedOnly && !hasPinnedFiles) {
      this._showPinnedOnly = false
      this.updateCriticalContext('aiContextStacker.pinnedOnly', false)
    }
  }

  private refreshSmartVisibility(): void {
    const editor = vscode.window.activeTextEditor
    this.updateCriticalContext('aiContextStacker.isTextEditorActive', !!editor)
  }

  private clearAllPendingTimers(): void {
    this.pendingUpdates.forEach(clearTimeout)
    this.pendingUpdates.clear()
  }
}
