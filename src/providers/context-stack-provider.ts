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

  private disposables: vscode.Disposable[] = []

  constructor(
    private context: vscode.ExtensionContext,
    private ignorePatternProvider: IgnorePatternProvider,
    private trackManager: ContextTrackManager,
  ) {
    this.trackManager.onDidChangeTrack(() => this.handleTrackChange())

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.handleDocChange(e.document)),
      vscode.workspace.onDidSaveTextDocument((doc) => this.handleDocChange(doc)),
    )

    this.enrichFileStats(this.getFiles())
  }

  private handleDocChange(doc: vscode.TextDocument) {
    if (this.trackManager.hasUri(doc.uri)) {
      this._onDidChangeTreeData.fire()
    }
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

  private handleTrackChange(): void {
    this._onDidChangeTreeData.fire()
    this.enrichFileStats(this.getFiles())
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
    return item
  }

  private createFileTreeItem(element: StagedFile): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label)
    item.resourceUri = element.uri
    item.contextValue = 'stagedFile'

    // Navigation Sync: Click to open
    item.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [element.uri],
    }

    if (element.isBinary) {
      item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('notificationsWarningIcon.foreground'))
      item.description = 'Binary • Skipped'
      item.tooltip = `${element.uri.fsPath}\n⚠ Binary file detected.`
      return item
    }

    // Visual Weight Logic
    const tokenCount = element.stats?.tokenCount ?? 0
    item.iconPath = new vscode.ThemeIcon('file', this.getIconColor(tokenCount))

    this.decorateTreeItem(item, element)
    return item
  }

  private getIconColor(tokenCount: number): vscode.ThemeColor | undefined {
    if (tokenCount > this.HIGH_TOKEN_THRESHOLD) {
      return new vscode.ThemeColor('charts.orange') // Visual warning for heavy files
    }
    return undefined
  }

  private decorateTreeItem(item: vscode.TreeItem, element: StagedFile): void {
    const relativePath = vscode.workspace.asRelativePath(element.uri)
    const folderPath = relativePath.substring(0, relativePath.lastIndexOf('/'))
    const parts: string[] = []
    const isDirty = vscode.workspace.textDocuments.some(
      (doc) => doc.uri.toString() === element.uri.toString() && doc.isDirty,
    )

    if (element.stats) parts.push(`${this.formatTokenCount(element.stats.tokenCount)} tokens`)
    else parts.push('calculating...')

    if (folderPath && folderPath !== relativePath) parts.push(folderPath)

    item.description = parts.join(' • ')
    item.label = isDirty ? `${element.label} ●` : element.label
    item.tooltip = `${element.uri.fsPath}\nTokens: ${element.stats?.tokenCount ?? '...'}`
  }

  formatTokenCount(count: number): string {
    return count >= 1000 ? `~${(count / 1000).toFixed(1)}k` : `~${count}`
  }

  addFiles(uris: vscode.Uri[]): void {
    const newFiles = this.trackManager.addFilesToActive(uris)
    if (newFiles.length === 0) return
    this._onDidChangeTreeData.fire()
    this.enrichFileStats(newFiles)
  }

  addFile(uri: vscode.Uri): void {
    this.addFiles([uri])
  }

  removeFile(file: StagedFile): void {
    this.removeFiles([file])
  }

  removeFiles(filesToRemove: StagedFile[]): void {
    this.trackManager.removeFilesFromActive(filesToRemove)
    this._onDidChangeTreeData.fire()
  }

  clear(): void {
    this.trackManager.clearActive()
    this._onDidChangeTreeData.fire()
  }

  private async enrichFileStats(targets: StagedFile[]): Promise<void> {
    const decoder = new TextDecoder()

    for (const file of targets) {
      if (file.stats) continue

      try {
        const uint8Array = await vscode.workspace.fs.readFile(file.uri)
        const snippet = uint8Array.slice(0, 512)
        const isBinary = snippet.some((byte) => byte === 0)

        if (isBinary) {
          file.isBinary = true
          file.stats = { tokenCount: 0, charCount: 0 }
        } else {
          file.isBinary = false
          const content = decoder.decode(uint8Array)
          const measurements = TokenEstimator.measure(content)
          file.stats = { tokenCount: measurements.tokenCount, charCount: content.length }
        }
      } catch (error) {
        Logger.warn(`Failed to read stats for ${file.uri.fsPath}`)
        file.stats = { tokenCount: 0, charCount: 0 }
      }
    }
    this._onDidChangeTreeData.fire()
  }

  dispose() {
    this._onDidChangeTreeData.dispose()
    this.disposables.forEach((d) => d.dispose())
  }
}
