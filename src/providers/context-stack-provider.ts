import * as path from 'path'
import { TextDecoder } from 'util'
import * as vscode from 'vscode'

import { type StagedFile } from '../models'
import { categorizeTargets, handleFolderScanning, Logger, TokenEstimator } from '../utils'
import { ContextTrackManager } from './context-track-manager'
import { IgnorePatternProvider } from './ignore-pattern-provider'

/**
 * Acts as the ViewModel for the active track.
 * Handles rendering, coordinates token calculation, and visualizes "weight".
 */
export class ContextStackProvider
  implements vscode.TreeDataProvider<StagedFile>, vscode.TreeDragAndDropController<StagedFile>, vscode.Disposable
{
  private _onDidChangeTreeData = new vscode.EventEmitter<StagedFile | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  public readonly dragMimeTypes: readonly string[] = ['text/uri-list', 'text/plain']
  public readonly dropMimeTypes: readonly string[] = ['text/uri-list', 'text/plain']

  private readonly EMPTY_URI = vscode.Uri.parse('ai-stack:empty-drop-target')
  private readonly EMPTY_ID = 'emptyState'
  private readonly HIGH_TOKEN_THRESHOLD = 5000
  private readonly DEBOUNCE_MS = 400

  // Tracks filenames that appear >1 time to trigger smart labeling
  private nameCollisions = new Set<string>()
  private pendingUpdates = new Map<string, NodeJS.Timeout>()
  private disposables: vscode.Disposable[] = []

  constructor(
    private context: vscode.ExtensionContext,
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
   * Handles live document updates with debouncing to prevent excessive calculation.
   */
  private handleDocChange(doc: vscode.TextDocument, immediate = false) {
    // 1. Filter: Only process files currently in the active track
    const activeFiles = this.trackManager.getActiveTrack().files
    const targetFile = activeFiles.find((f) => f.uri.toString() === doc.uri.toString())

    if (!targetFile) return

    // 2. Clear existing debounce timer for this file
    const key = doc.uri.toString()
    if (this.pendingUpdates.has(key)) {
      clearTimeout(this.pendingUpdates.get(key)!)
    }

    // 3. Define the update logic
    const updateLogic = () => {
      this.updateFileStats(targetFile, doc.getText())
      this.pendingUpdates.delete(key)
    }

    // 4. Execute immediately (on save) or debounce (on type)
    if (immediate) {
      updateLogic()
    } else {
      const timeout = setTimeout(updateLogic, this.DEBOUNCE_MS)
      this.pendingUpdates.set(key, timeout)
    }
  }

  /**
   * Updates stats in-memory and triggers a surgical tree update for a single node.
   */
  private updateFileStats(file: StagedFile, content: string) {
    try {
      const measurements = TokenEstimator.measure(content)
      file.stats = {
        tokenCount: measurements.tokenCount,
        charCount: content.length,
      }
      // Fire with the specific element to update only that row
      this._onDidChangeTreeData.fire(file)
    } catch (error) {
      Logger.warn(`Failed to update live stats for ${file.label}`)
    }
  }

  /**
   * Centralized refresh: Recalculates collisions -> Fires View Update -> Enriches Stats.
   */
  private refreshState(): void {
    const files = this.getFiles()
    this.calculateCollisions(files)
    this._onDidChangeTreeData.fire()
    this.enrichFileStats(files)
  }

  private calculateCollisions(files: StagedFile[]): void {
    const counts = new Map<string, number>()
    files.forEach((f) => counts.set(f.label, (counts.get(f.label) || 0) + 1))

    this.nameCollisions.clear()
    counts.forEach((count, name) => {
      if (count > 1) this.nameCollisions.add(name)
    })
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

  async handleDrop(
    target: StagedFile | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken,
  ): Promise<void> {
    const uris = await this.extractUrisFromTransfer(dataTransfer)
    if (uris.length === 0) return

    const { files, folders } = await categorizeTargets(uris)
    if (files.length > 0) this.addFiles(files)
    if (folders.length > 0) await handleFolderScanning(folders, this, this.ignorePatternProvider)
  }

  private async extractUrisFromTransfer(dataTransfer: vscode.DataTransfer): Promise<vscode.Uri[]> {
    const uriListItem = dataTransfer.get('text/uri-list')
    if (uriListItem) return this.parseUriList(await uriListItem.asString())
    const plainItem = dataTransfer.get('text/plain')
    if (plainItem) return this.parseUriList(await plainItem.asString())
    return []
  }

  private parseUriList(content: string): vscode.Uri[] {
    return content
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => {
        try {
          if (!line.startsWith('file:') && !line.startsWith('vscode-remote:')) return vscode.Uri.file(line)
          return vscode.Uri.parse(line)
        } catch {
          return null
        }
      })
      .filter((u): u is vscode.Uri => u !== null)
  }

  getParent(element: StagedFile): vscode.ProviderResult<StagedFile> {
    return undefined
  }

  getChildren(element?: StagedFile): StagedFile[] {
    if (element) return []
    const files = this.getFiles()
    if (files.length === 0) {
      return [{ uri: this.EMPTY_URI, label: 'Drag files here to start...', stats: undefined } as StagedFile]
    }
    return files
  }

  getTreeItem(element: StagedFile): vscode.TreeItem {
    if (element.uri.scheme === this.EMPTY_URI.scheme) return this.createEmptyTreeItem(element)
    return this.createFileTreeItem(element)
  }

  private createEmptyTreeItem(element: StagedFile): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label)
    item.iconPath = new vscode.ThemeIcon('cloud-upload')
    item.contextValue = this.EMPTY_ID
    // Actionable Empty State: Click to open file picker
    item.command = {
      command: 'aiContextStacker.addFilePicker',
      title: 'Add Files',
    }
    item.tooltip = 'Click to add files, or drag and drop items here.'
    return item
  }

  private createFileTreeItem(element: StagedFile): vscode.TreeItem {
    const label = this.getSmartLabel(element)
    const item = new vscode.TreeItem(label)

    item.resourceUri = element.uri
    item.contextValue = 'stagedFile'
    item.command = { command: 'vscode.open', title: 'Open File', arguments: [element.uri] }

    if (element.isBinary) {
      this.decorateBinaryItem(item, element)
      return item
    }

    const tokenCount = element.stats?.tokenCount ?? 0
    item.iconPath = new vscode.ThemeIcon('file', this.getIconColor(tokenCount))
    this.decorateStandardItem(item, element)

    return item
  }

  /**
   * Generates the label. If collision detected, appends (parentDir).
   * Also appends dirty indicator '●'.
   */
  private getSmartLabel(element: StagedFile): string {
    let label = element.label

    if (this.nameCollisions.has(element.label)) {
      const relative = vscode.workspace.asRelativePath(element.uri)
      const parentDir = path.dirname(relative).split(path.sep).pop()
      if (parentDir && parentDir !== '.') {
        label = `${element.label} (${parentDir})`
      }
    }

    const isDirty = vscode.workspace.textDocuments.some(
      (doc) => doc.uri.toString() === element.uri.toString() && doc.isDirty,
    )
    return isDirty ? `${label} ●` : label
  }

  private decorateBinaryItem(item: vscode.TreeItem, element: StagedFile) {
    item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('notificationsWarningIcon.foreground'))
    item.description = 'Binary • Skipped'
    item.tooltip = `${element.uri.fsPath}\n⚠ Binary file detected.`
  }

  private decorateStandardItem(item: vscode.TreeItem, element: StagedFile) {
    const relativePath = vscode.workspace.asRelativePath(element.uri)
    const folderPath = relativePath.substring(0, relativePath.lastIndexOf('/'))
    const parts: string[] = []

    if (element.stats) parts.push(`${this.formatTokenCount(element.stats.tokenCount)} tokens`)
    else parts.push('calculating...')

    // Only show path in description if it wasn't added to the label via smart labeling
    if (folderPath && folderPath !== relativePath && !this.nameCollisions.has(element.label)) {
      parts.push(folderPath)
    }

    item.description = parts.join(' • ')
    item.tooltip = `${element.uri.fsPath}\nTokens: ${element.stats?.tokenCount ?? '...'}`
  }

  private getIconColor(tokenCount: number): vscode.ThemeColor | undefined {
    return tokenCount > this.HIGH_TOKEN_THRESHOLD ? new vscode.ThemeColor('charts.orange') : undefined
  }

  formatTokenCount(count: number): string {
    return count >= 1000 ? `~${(count / 1000).toFixed(1)}k` : `~${count}`
  }

  addFiles(uris: vscode.Uri[]): void {
    const newFiles = this.trackManager.addFilesToActive(uris)
    if (newFiles.length > 0) this.refreshState()
  }

  addFile(uri: vscode.Uri): void {
    this.addFiles([uri])
  }

  removeFile(file: StagedFile): void {
    this.removeFiles([file])
  }

  removeFiles(filesToRemove: StagedFile[]): void {
    this.trackManager.removeFilesFromActive(filesToRemove)
    this.refreshState()
  }

  clear(): void {
    this.trackManager.clearActive()
    this.refreshState()
  }

  private async enrichFileStats(targets: StagedFile[]): Promise<void> {
    const decoder = new TextDecoder()
    let changed = false

    for (const file of targets) {
      if (file.stats) continue

      try {
        const uint8Array = await vscode.workspace.fs.readFile(file.uri)
        const isBinary = uint8Array.slice(0, 512).some((b) => b === 0)

        if (isBinary) {
          file.isBinary = true
          file.stats = { tokenCount: 0, charCount: 0 }
        } else {
          file.isBinary = false
          const content = decoder.decode(uint8Array)
          const measurements = TokenEstimator.measure(content)
          file.stats = { tokenCount: measurements.tokenCount, charCount: content.length }
        }
        changed = true
      } catch (error) {
        Logger.warn(`Failed to read stats for ${file.uri.fsPath}`)
      }
    }
    if (changed) this._onDidChangeTreeData.fire()
  }

  dispose() {
    this._onDidChangeTreeData.dispose()
    this.disposables.forEach((d) => d.dispose())
  }
}
