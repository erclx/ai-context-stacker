import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile } from '../models'
import { StatsProcessor, TreeBuilder } from '../services'
import { StackItemRenderer } from '../ui'
import { Logger } from '../utils'
import { IgnoreManager } from './ignore-manager'
import { TrackManager } from './track-manager'

/**
 * The primary data provider for the "Context Stack" view in VS Code.
 * Responsibilities:
 * - Adapts the flat list of StagedFiles into a hierarchical TreeView.
 * - Handles live updates when documents change (debounced token counting).
 * - Manages the lifecycle of UI refreshes and background statistics enrichment.
 */
export class StackProvider implements vscode.TreeDataProvider<StackTreeItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<StackTreeItem | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  /** Delay in ms to wait after user typing stops before re-calculating tokens. */
  private readonly DEBOUNCE_MS = 400

  private pendingUpdates = new Map<string, ReturnType<typeof setTimeout>>()
  private disposables: vscode.Disposable[] = []

  private _cachedTree: StackTreeItem[] | undefined
  private _cachedTotalTokens: number = 0

  /** * Dirty flag for lazy reconstruction of the tree view.
   * If false, getChildren returns the cached tree immediately.
   */
  private _treeDirty = true

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

  private registerListeners(): void {
    // Rebuild UI when the underlying data track changes
    this.trackManager.onDidChangeTrack(() => {
      this._treeDirty = true
      this.rebuildCacheAndRefresh()
    })

    // Listen for file edits to update token counts in real-time
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.handleDocChange(e.document)),
      vscode.workspace.onDidSaveTextDocument((doc) => this.handleDocChange(doc, true)),
    )
  }

  /**
   * Returns the raw list of files in the current active track.
   */
  public getFiles(): StagedFile[] {
    return this.trackManager.getActiveTrack().files
  }

  public getActiveTrackName(): string {
    return this.trackManager.getActiveTrack().name
  }

  /**
   * Returns the cached sum of tokens across all staged files.
   */
  public getTotalTokens(): number {
    return this._cachedTotalTokens
  }

  public formatTokenCount(count: number): string {
    return this.renderer.formatTokenCount(count)
  }

  /**
   * VS Code TreeDataProvider implementation.
   * Returns child elements for the given node, or the root elements if no element is passed.
   */
  public getChildren(element?: StackTreeItem): StackTreeItem[] {
    if (element && isStagedFolder(element)) {
      return element.children
    }

    // Return cached tree if no structural changes occurred (Performance Optimization)
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

  /**
   * Triggers a full UI refresh.
   * 1. Rebuilds the internal tree structure.
   * 2. Notifies VS Code to redraw the view.
   * 3. Starts a background task to calculate accurate token stats.
   */
  private rebuildCacheAndRefresh(): void {
    this.rebuildTreeCache()
    this._treeDirty = false
    this._onDidChangeTreeData.fire()
    void this.enrichStatsInBackground()
  }

  /**
   * Calculates token counts for files that haven't been measured yet.
   * This is done asynchronously to avoid blocking the UI thread during initial render.
   */
  private async enrichStatsInBackground(): Promise<void> {
    try {
      await this.statsProcessor.enrichFileStats(this.getFiles())
      this.recalculateTotalTokens()
      this._onDidChangeTreeData.fire()
    } catch (error) {
      Logger.error('Failed to enrich file stats', error as Error)
    }
  }

  private rebuildTreeCache(): StackTreeItem[] {
    const files = this.getFiles()
    if (files.length === 0) {
      this._cachedTree = [this.renderer.createPlaceholderItem()]
    } else {
      this._cachedTree = this.treeBuilder.build(files)
    }
    this.recalculateTotalTokens()
    return this._cachedTree
  }

  private recalculateTotalTokens(): void {
    this._cachedTotalTokens = this.getFiles().reduce((sum, f) => sum + (f.stats?.tokenCount ?? 0), 0)
  }

  private handleDocChange(doc: vscode.TextDocument, immediate = false): void {
    const targetFile = this.findStagedFile(doc.uri)
    if (!targetFile) return
    this.scheduleStatsUpdate(doc, targetFile, immediate)
  }

  /**
   * Debounces token calculation requests to prevent high CPU usage while typing.
   */
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

      // Incremental update of total tokens to avoid full array reduction
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

  /**
   * Adds new files to the stack and refreshes the view.
   */
  public addFiles(uris: vscode.Uri[]): void {
    const newFiles = this.trackManager.addFilesToActive(uris)
    if (newFiles.length > 0) {
      this._treeDirty = true
      this.rebuildCacheAndRefresh()
    }
  }

  public addFile(uri: vscode.Uri): void {
    this.addFiles([uri])
  }

  /**
   * Removes specific files from the stack.
   */
  public removeFiles(filesToRemove: StagedFile[]): void {
    this.trackManager.removeFilesFromActive(filesToRemove)
    this._treeDirty = true
    this.rebuildCacheAndRefresh()
  }

  /**
   * Clears all unpinned files from the current track.
   */
  public clear(): void {
    this.trackManager.clearActive()
    this._treeDirty = true
    this.rebuildCacheAndRefresh()
  }

  /**
   * Cancels all pending debounce timers to prevent memory leaks or
   * updates firing after the provider is disposed.
   */
  private clearAllPendingTimers(): void {
    this.pendingUpdates.forEach((timer) => clearTimeout(timer))
    this.pendingUpdates.clear()
  }

  public dispose(): void {
    this._onDidChangeTreeData.dispose()
    this.disposables.forEach((d) => d.dispose())
    this.clearAllPendingTimers()
  }
}
