import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, type StagedFile } from '../models'
import { StatsProcessor, TreeBuilder } from '../services'
import { StackItemRenderer } from '../ui'
import { categorizeTargets, handleFolderScanning, Logger } from '../utils'
import { extractUrisFromTransfer } from '../utils/drag-drop'
import { ContextTrackManager } from './context-track-manager'
import { IgnorePatternProvider } from './ignore-pattern-provider'

/**
 * Acts as the ViewModel for the active track.
 * Orchestrates tree data flow, live stats updates, and drag-and-drop events.
 */
export class ContextStackProvider
  implements vscode.TreeDataProvider<StackTreeItem>, vscode.TreeDragAndDropController<StackTreeItem>, vscode.Disposable
{
  private _onDidChangeTreeData = new vscode.EventEmitter<StackTreeItem | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  public readonly dragMimeTypes: readonly string[] = ['text/uri-list']
  public readonly dropMimeTypes: readonly string[] = ['text/uri-list']

  private readonly DEBOUNCE_MS = 400
  private pendingUpdates = new Map<string, NodeJS.Timeout>()
  private disposables: vscode.Disposable[] = []

  // Service Dependencies
  private treeBuilder = new TreeBuilder()
  private statsProcessor = new StatsProcessor()
  private renderer = new StackItemRenderer()

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

  /**
   * Retrieves the raw list of files from the active track.
   */
  public getFiles(): StagedFile[] {
    return this.trackManager.getActiveTrack().files
  }

  public getActiveTrackName(): string {
    return this.trackManager.getActiveTrack().name
  }

  public getTotalTokens(): number {
    return this.getFiles().reduce((sum, file) => sum + (file.stats?.tokenCount ?? 0), 0)
  }

  /**
   * Proxy for external consumers to format token counts consistently.
   */
  public formatTokenCount(count: number): string {
    return this.renderer.formatTokenCount(count)
  }

  // --- TreeDataProvider Implementation ---

  public getChildren(element?: StackTreeItem): StackTreeItem[] {
    if (element) {
      return isStagedFolder(element) ? element.children : []
    }

    const files = this.getFiles()
    if (files.length === 0) {
      return [this.renderer.createPlaceholderItem()]
    }

    return this.treeBuilder.build(files)
  }

  public getTreeItem(element: StackTreeItem): vscode.TreeItem {
    return this.renderer.render(element)
  }

  public getParent(element: StackTreeItem): vscode.ProviderResult<StackTreeItem> {
    return undefined
  }

  // --- Event Handling (Debouncing) ---

  /**
   * Updates file statistics when a document changes.
   * Uses a debounce strategy to prevent performance hits during rapid typing.
   */
  private handleDocChange(doc: vscode.TextDocument, immediate = false): void {
    const targetFile = this.findStagedFile(doc.uri)
    if (!targetFile) return

    const key = doc.uri.toString()

    // Clear existing timer to reset the debounce window
    if (this.pendingUpdates.has(key)) {
      clearTimeout(this.pendingUpdates.get(key)!)
    }

    if (immediate) {
      this.performStatsUpdate(doc, targetFile)
    } else {
      const timer = setTimeout(() => {
        this.performStatsUpdate(doc, targetFile)
        this.pendingUpdates.delete(key)
      }, this.DEBOUNCE_MS)

      this.pendingUpdates.set(key, timer)
    }
  }

  private performStatsUpdate(doc: vscode.TextDocument, file: StagedFile): void {
    try {
      const stats = this.statsProcessor.measure(doc.getText())
      file.stats = stats
      this._onDidChangeTreeData.fire()
    } catch (error) {
      Logger.warn(`Failed to update live stats for ${file.label}`)
    }
  }

  private findStagedFile(uri: vscode.Uri): StagedFile | undefined {
    return this.trackManager.getActiveTrack().files.find((f) => f.uri.toString() === uri.toString())
  }

  // --- State Management ---

  private refreshState(): void {
    this._onDidChangeTreeData.fire()

    // Fire-and-forget: Enrich stats in background to keep UI responsive
    void this.statsProcessor.enrichFileStats(this.getFiles()).then(() => {
      this._onDidChangeTreeData.fire()
    })
  }

  public addFiles(uris: vscode.Uri[]): void {
    const newFiles = this.trackManager.addFilesToActive(uris)
    if (newFiles.length > 0) this.refreshState()
  }

  public addFile(uri: vscode.Uri): void {
    this.addFiles([uri])
  }

  public removeFiles(filesToRemove: StagedFile[]): void {
    this.trackManager.removeFilesFromActive(filesToRemove)
    this.refreshState()
  }

  public clear(): void {
    this.trackManager.clearActive()
    this.refreshState()
  }

  // --- Drag & Drop Controller ---

  /**
   * Handles files dropped onto the tree view.
   * Filters external files and delegates folder scanning.
   */
  public async handleDrop(target: StackTreeItem | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    const uris = await extractUrisFromTransfer(dataTransfer)

    if (!this.validateDroppedUris(uris, dataTransfer)) return

    const { validUris, rejectedCount } = this.filterWorkspaceUris(uris)

    if (rejectedCount > 0) {
      void vscode.window.showInformationMessage(`Ignored ${rejectedCount} file(s) outside the workspace.`)
    }

    if (validUris.length > 0) {
      await this.processDroppedFiles(validUris)
    }
  }

  private validateDroppedUris(uris: vscode.Uri[], dataTransfer: vscode.DataTransfer): boolean {
    if (uris.length > 0) return true

    // Only warn if the user actually tried to drop text/plain that we can't parse
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
  }
}
