import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, type StagedFile } from '../models'
import { StatsProcessor, TreeBuilder } from '../services'
import { StackItemRenderer } from '../ui'
import { categorizeTargets, handleFolderScanning, Logger } from '../utils'
import { extractUrisFromTransfer } from '../utils/drag-drop'
import { ContextTrackManager } from './context-track-manager'
import { IgnorePatternProvider } from './ignore-pattern-provider'

/**
 * Orchestrates the TreeView for the active Context Track.
 * * Features:
 * - Structural Caching (O(1) read access)
 * - Debounced Live Stats Updates
 * - Drag and Drop File Processing
 */
export class ContextStackProvider
  implements vscode.TreeDataProvider<StackTreeItem>, vscode.TreeDragAndDropController<StackTreeItem>, vscode.Disposable
{
  // --- Events ---
  private _onDidChangeTreeData = new vscode.EventEmitter<StackTreeItem | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  // --- DND Config ---
  public readonly dragMimeTypes: readonly string[] = ['text/uri-list']
  public readonly dropMimeTypes: readonly string[] = ['text/uri-list']

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
    // Track changes
    this.trackManager.onDidChangeTrack(() => this.rebuildCacheAndRefresh())

    // Document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.handleDocChange(e.document)),
      vscode.workspace.onDidSaveTextDocument((doc) => this.handleDocChange(doc, true)),
    )
  }

  // --- Public API ---

  /**
   * Retrieves the raw list of files in the current track.
   */
  public getFiles(): StagedFile[] {
    return this.trackManager.getActiveTrack().files
  }

  /**
   * Returns the user-facing name of the current track.
   */
  public getActiveTrackName(): string {
    return this.trackManager.getActiveTrack().name
  }

  /**
   * Returns the cached total token count for the active track.
   * Access is O(1).
   */
  public getTotalTokens(): number {
    return this._cachedTotalTokens
  }

  /**
   * Formats a raw number into a readable token string (e.g. "1.2k").
   */
  public formatTokenCount(count: number): string {
    return this.renderer.formatTokenCount(count)
  }

  // --- TreeDataProvider Implementation ---

  public getChildren(element?: StackTreeItem): StackTreeItem[] {
    // 1. Folder Children: Return directly from model
    if (element && isStagedFolder(element)) {
      return element.children
    }

    // 2. Root: Return Cache
    if (this._cachedTree) {
      return this._cachedTree
    }

    // 3. Fallback: Rebuild (Rare)
    return this.rebuildTreeCache()
  }

  public getTreeItem(element: StackTreeItem): vscode.TreeItem {
    return this.renderer.render(element)
  }

  public getParent(element: StackTreeItem): vscode.ProviderResult<StackTreeItem> {
    return undefined // View structure is flat enough to not require reverse traversal
  }

  // --- State Management & Caching ---

  /**
   * Full Rebuild: Reconstructs tree structure and triggers stat calculation.
   * Use only when file list structure changes (Add/Remove).
   */
  private rebuildCacheAndRefresh(): void {
    this.rebuildTreeCache()
    this._onDidChangeTreeData.fire()

    // Background enrichment
    void this.enrichStatsInBackground()
  }

  /**
   * Calculates stats for files that might be missing them.
   * Runs in background to keep UI responsive.
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

  // --- Event Handling (Incremental Updates) ---

  /**
   * Handles text document changes to update stats in real-time.
   * Debounces the update to prevent CPU spikes.
   */
  private handleDocChange(doc: vscode.TextDocument, immediate = false): void {
    const targetFile = this.findStagedFile(doc.uri)
    if (!targetFile) return

    this.scheduleStatsUpdate(doc, targetFile, immediate)
  }

  private scheduleStatsUpdate(doc: vscode.TextDocument, file: StagedFile, immediate: boolean): void {
    const key = doc.uri.toString()

    // Clear existing timer
    if (this.pendingUpdates.has(key)) {
      clearTimeout(this.pendingUpdates.get(key)!)
      this.pendingUpdates.delete(key)
    }

    if (immediate) {
      this.performStatsUpdate(doc, file)
      return
    }

    // Schedule new timer
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

      // Incremental Global Update
      const delta = newStats.tokenCount - oldTokens
      this._cachedTotalTokens += delta

      // Targeted UI Refresh
      this._onDidChangeTreeData.fire(file)
    } catch (error) {
      Logger.warn(`Failed to update live stats for ${file.label}`)
    }
  }

  private findStagedFile(uri: vscode.Uri): StagedFile | undefined {
    return this.trackManager.getActiveTrack().files.find((f) => f.uri.toString() === uri.toString())
  }

  // --- Actions ---

  /**
   * Adds files to the current track and refreshes the view.
   */
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

  // --- Drag & Drop Controller ---

  public async handleDrop(target: StackTreeItem | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    try {
      const uris = await extractUrisFromTransfer(dataTransfer)

      if (!this.validateDroppedUris(uris, dataTransfer)) return

      const { validUris, rejectedCount } = this.filterWorkspaceUris(uris)

      if (rejectedCount > 0) {
        void vscode.window.showInformationMessage(`Ignored ${rejectedCount} file(s) outside workspace.`)
      }

      if (validUris.length > 0) {
        await this.processDroppedFiles(validUris)
      }
    } catch (error) {
      Logger.error('Failed to handle drop event', error as Error)
      void vscode.window.showErrorMessage('Failed to process dropped files.')
    }
  }

  private validateDroppedUris(uris: vscode.Uri[], dataTransfer: vscode.DataTransfer): boolean {
    if (uris.length > 0) return true

    // Check if it was a text drop that resulted in no URIs
    if (dataTransfer.get('text/plain')) {
      void vscode.window.showWarningMessage('Drop ignored: No valid files detected.')
    }
    return false
  }

  private filterWorkspaceUris(uris: vscode.Uri[]): { validUris: vscode.Uri[]; rejectedCount: number } {
    const validUris = uris.filter((uri) => vscode.workspace.getWorkspaceFolder(uri))
    const rejectedCount = uris.length - validUris.length

    if (validUris.length === 0 && rejectedCount > 0) {
      void vscode.window.showWarningMessage('Drop ignored: Files must be within the current workspace.')
    }

    return { validUris, rejectedCount }
  }

  private async processDroppedFiles(uris: vscode.Uri[]): Promise<void> {
    const { files, folders } = await categorizeTargets(uris)

    if (files.length > 0) {
      this.addFiles(files)
    }

    if (folders.length > 0) {
      await handleFolderScanning(folders, this, this.ignorePatternProvider)
    }
  }

  public dispose(): void {
    this._onDidChangeTreeData.dispose()
    this.disposables.forEach((d) => d.dispose())
    this.pendingUpdates.forEach((timer) => clearTimeout(timer))
    this.pendingUpdates.clear()
  }
}
