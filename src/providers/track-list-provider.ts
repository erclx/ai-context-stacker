import * as vscode from 'vscode'

import { type ContextTrack } from '../models'
import { ContextStackProvider } from './context-stack-provider'
import { ContextTrackManager } from './context-track-manager'

/**
 * Provides tree view for context tracks with live token stats.
 */
export class TrackListProvider implements vscode.TreeDataProvider<ContextTrack>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<ContextTrack | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private disposable: vscode.Disposable
  private stackProvider?: ContextStackProvider

  constructor(private contextTrackManager: ContextTrackManager) {
    this.disposable = this.contextTrackManager.onDidChangeTrack(() => {
      this.refresh()
    })
  }

  /**
   * Injects stack provider for live token stats on active track.
   */
  setStackProvider(provider: ContextStackProvider) {
    this.stackProvider = provider
    this.stackProvider.onDidChangeTreeData(() => this.refresh())
  }

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: ContextTrack): vscode.TreeItem {
    const isActive = element.id === this.contextTrackManager.getActiveTrack().id
    const item = new vscode.TreeItem(element.name)

    item.contextValue = 'contextTrack'
    item.iconPath = isActive ? new vscode.ThemeIcon('check') : new vscode.ThemeIcon('git-branch')

    if (isActive && this.stackProvider) {
      const fileCount = element.files.length
      const tokenCount = this.stackProvider.getTotalTokens()
      const formattedTokens = tokenCount >= 1000 ? `~${(tokenCount / 1000).toFixed(1)}k` : `~${tokenCount}`

      item.description = `(Active) • ${fileCount} files • ${formattedTokens} tokens`
    } else {
      item.description = `${element.files.length} files`
    }

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

  dispose() {
    this.disposable.dispose()
    this._onDidChangeTreeData.dispose()
  }
}
