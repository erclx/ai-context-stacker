import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, type StagedFile } from '../models'
import { StatsProcessor, TreeBuilder } from '../services'
import { StackItemRenderer } from '../ui'
import { Logger } from '../utils'
import { ContextTrackManager } from './context-track-manager'
import { IgnorePatternProvider } from './ignore-pattern-provider'

/**
 * Orchestrates the TreeView for the active Context Track.
 * Features:
 * - Structural Caching (O(1) read access)
 * - Debounced Live Stats Updates
 */
export class ContextStackProvider implements vscode.TreeDataProvider<StackTreeItem>, vscode.Disposable {
  // --- Events ---
  private _onDidChangeTreeData = new vscode.EventEmitter<StackTreeItem | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  // --- Internal State ---
  private readonly DEBOUNCE_MS = 400
  private pendingUpdates = new Map<string, NodeJS.Timeout>()
  private disposables: vscode.Disposable[] = []

  // --- Caching ---
  private _cachedTree: StackTreeItem[] | undefined
  private _cachedTotalTokens: number = 0

  // --- Dependencies ---
  private treeBuilder = new TreeBuilder()
  private statsProcessor = new StatsProcessor()
  private renderer = new StackItemRenderer()

  constructor(
    private extensionContext: vscode.ExtensionContext,
    private ignorePatternProvider: IgnorePatternProvider,
    private trackManager: ContextTrackManager,
  ) {
    this.registerListeners()
    this.rebuildCacheAndRefresh()
  }

  private registerListeners(): void {
    this.trackManager.onDidChangeTrack(() => this.rebuildCacheAndRefresh())

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.handleDocChange(e.document)),
      vscode.workspace.onDidSaveTextDocument((doc) => this.handleDocChange(doc, true)),
    )
  }

  // --- Public API ---

  public getFiles(): StagedFile[] {
    return this.trackManager.getActiveTrack().files
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

  // --- TreeDataProvider Implementation ---

  public getChildren(element?: StackTreeItem): StackTreeItem[] {
    if (element && isStagedFolder(element)) {
      return element.children
    }
    if (this._cachedTree) {
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

  // --- State Management & Caching ---

  private rebuildCacheAndRefresh(): void {
    this.rebuildTreeCache()
    this._onDidChangeTreeData.fire()
    void this.enrichStatsInBackground()
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

  // --- Event Handling ---

  private handleDocChange(doc: vscode.TextDocument, immediate = false): void {
    const targetFile = this.findStagedFile(doc.uri)
    if (!targetFile) return
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

  // --- Actions ---

  public addFiles(uris: vscode.Uri[]): void {
    const newFiles = this.trackManager.addFilesToActive(uris)
    if (newFiles.length > 0) {
      this.rebuildCacheAndRefresh()
    }
  }

  public addFile(uri: vscode.Uri): void {
    this.addFiles([uri])
  }

  public removeFiles(filesToRemove: StagedFile[]): void {
    this.trackManager.removeFilesFromActive(filesToRemove)
    this.rebuildCacheAndRefresh()
  }

  public clear(): void {
    this.trackManager.clearActive()
    this.rebuildCacheAndRefresh()
  }

  public dispose(): void {
    this._onDidChangeTreeData.dispose()
    this.disposables.forEach((d) => d.dispose())
    this.pendingUpdates.forEach((timer) => clearTimeout(timer))
    this.pendingUpdates.clear()
  }
}
