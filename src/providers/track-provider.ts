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
  public setStackProvider(provider: StackProvider): void {
    this.stackProvider = provider
    this.stackProvider.onDidChangeTreeData(() => this.refresh())
  }

  public refresh(): void {
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
    const targetId = target?.id

    if (sourceId === targetId) return

    this.contextTrackManager.reorderTracks(sourceId, targetId)
  }

  // --- TreeDataProvider Implementation ---

  public getTreeItem(element: ContextTrack): vscode.TreeItem {
    const isActive = element.id === this.contextTrackManager.getActiveTrack().id
    const item = new vscode.TreeItem(element.name)

    item.contextValue = this.getTrackContextValue(element, isActive)
    item.iconPath = isActive ? new vscode.ThemeIcon('check') : new vscode.ThemeIcon('git-branch')
    item.description = this.getTrackDescription(element, isActive)

    item.command = {
      command: 'aiContextStacker.switchTrack',
      title: 'Switch Track',
      arguments: [element.id],
    }

    return item
  }

  public getChildren(element?: ContextTrack): ContextTrack[] {
    if (!this.contextTrackManager.isInitialized) return []
    if (element) return []
    return this.contextTrackManager.allTracks
  }

  public dispose(): void {
    this.disposable.dispose()
    this._onDidChangeTreeData.dispose()
  }

  // --- Helpers ---

  private getTrackContextValue(element: ContextTrack, isActive: boolean): string {
    const allTracks = this.contextTrackManager.allTracks
    const isOnly = allTracks.length === 1

    if (isOnly) {
      // If it's the only track, it is inherently active and protected
      return 'contextTrack:active:only'
    }

    const index = allTracks.findIndex((t) => t.id === element.id)
    const isFirst = index === 0
    const isLast = index === allTracks.length - 1

    const contextParts = ['contextTrack']
    if (isActive) contextParts.push('active')
    if (isFirst) contextParts.push('first')
    if (isLast) contextParts.push('last')

    return contextParts.join(':')
  }

  private getTrackDescription(element: ContextTrack, isActive: boolean): string {
    if (isActive && this.stackProvider) {
      const fileCount = element.files.length
      const tokenCount = this.stackProvider.getTotalTokens()
      const formattedTokens = this.stackProvider.formatTokenCount(tokenCount)

      return `(Active) • ${fileCount} files • ${formattedTokens} tokens`
    }

    return `${element.files.length} files`
  }
}
