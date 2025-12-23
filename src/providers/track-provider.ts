import * as vscode from 'vscode'

import { ContextTrack } from '../models'
import { StackProvider } from './stack-provider'
import { TrackManager } from './track-manager'

/**
 * Provides tree view for context tracks with live token stats.
 * Enables Drag and Drop and Context Menu reordering.
 */
export class TrackProvider
  implements vscode.TreeDataProvider<ContextTrack>, vscode.TreeDragAndDropController<ContextTrack>, vscode.Disposable
{
  private _onDidChangeTreeData = new vscode.EventEmitter<ContextTrack | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  // D&D Mime Types
  public readonly dragMimeTypes = ['application/vnd.code.tree.aiContextTracks']
  public readonly dropMimeTypes = ['application/vnd.code.tree.aiContextTracks']

  private disposable: vscode.Disposable
  private stackProvider?: StackProvider

  constructor(private contextTrackManager: TrackManager) {
    this.disposable = this.contextTrackManager.onDidChangeTrack(() => {
      this.refresh()
    })
  }

  /**
   * Injects stack provider for live token stats on active track.
   */
  setStackProvider(provider: StackProvider): void {
    this.stackProvider = provider
    this.stackProvider.onDidChangeTreeData(() => this.refresh())
  }

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  // --- Drag and Drop Implementation ---

  public handleDrag(
    source: readonly ContextTrack[],
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken,
  ): void | Thenable<void> {
    if (source.length === 0) return

    const trackId = source[0].id
    const item = new vscode.DataTransferItem(trackId)
    dataTransfer.set('application/vnd.code.tree.aiContextTracks', item)
  }

  public handleDrop(
    target: ContextTrack | undefined,
    sources: vscode.DataTransfer,
    token: vscode.CancellationToken,
  ): void | Thenable<void> {
    const transferItem = sources.get('application/vnd.code.tree.aiContextTracks')
    if (!transferItem) return

    const sourceId = transferItem.value as string
    const targetId = target?.id // undefined means drop at the end/root

    if (sourceId === targetId) return

    this.contextTrackManager.reorderTracks(sourceId, targetId)
  }

  // --- TreeDataProvider Implementation ---

  getTreeItem(element: ContextTrack): vscode.TreeItem {
    const isActive = element.id === this.contextTrackManager.getActiveTrack().id
    const item = new vscode.TreeItem(element.name)

    // Calculate position context (first/last) to smartly hide Move Up/Down commands
    const allTracks = this.contextTrackManager.allTracks
    const index = allTracks.findIndex((t) => t.id === element.id)
    const isFirst = index === 0
    const isLast = index === allTracks.length - 1

    // Build compound context value: "contextTrack:active:first", etc.
    const contextParts = ['contextTrack']
    if (isActive) contextParts.push('active')
    if (isFirst) contextParts.push('first')
    if (isLast) contextParts.push('last')

    item.contextValue = contextParts.join(':')
    item.iconPath = isActive ? new vscode.ThemeIcon('check') : new vscode.ThemeIcon('git-branch')
    item.description = this._getTrackDescription(element, isActive)

    item.command = {
      command: 'aiContextStacker.switchTrack',
      title: 'Switch Track',
      arguments: [element.id],
    }

    return item
  }

  getChildren(element?: ContextTrack): ContextTrack[] {
    if (element) return []
    return this.contextTrackManager.allTracks
  }

  dispose(): void {
    this.disposable.dispose()
    this._onDidChangeTreeData.dispose()
  }

  private _getTrackDescription(element: ContextTrack, isActive: boolean): string {
    if (isActive && this.stackProvider) {
      const fileCount = element.files.length
      const tokenCount = this.stackProvider.getTotalTokens()
      // Use standardized formatting from the provider
      const formattedTokens = this.stackProvider.formatTokenCount(tokenCount)

      return `(Active) • ${fileCount} files • ${formattedTokens} tokens`
    }

    return `${element.files.length} files`
  }
}
