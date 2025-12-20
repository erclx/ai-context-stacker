import * as vscode from 'vscode'

import { type ContextTrack } from '../models'
import { ContextStackProvider } from './context-stack-provider'
import { ContextTrackManager } from './context-track-manager'

/**
 * Acts as the ViewModel for the list of available context tracks.
 */
export class TrackListProvider implements vscode.TreeDataProvider<ContextTrack>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<ContextTrack | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private disposable: vscode.Disposable
  private stackProvider?: ContextStackProvider

  constructor(private contextTrackManager: ContextTrackManager) {
    // Listen for any track changes (renames, switches, deletions) to refresh the list
    this.disposable = this.contextTrackManager.onDidChangeTrack(() => {
      this.refresh()
    })
  }

  /**
   * Injection to access live stats for the active track.
   */
  setStackProvider(provider: ContextStackProvider) {
    this.stackProvider = provider
    // Re-render when stack provider updates (e.g. token recalculation)
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

    // Single click switches the track
    item.command = {
      command: 'aiContextStacker.switchTrack',
      title: 'Switch Track',
      arguments: [element.id],
    }

    return item
  }

  getChildren(element?: ContextTrack): ContextTrack[] {
    // Flattened list; no nesting
    if (element) return []
    return this.contextTrackManager.allTracks
  }

  dispose() {
    this.disposable.dispose()
    this._onDidChangeTreeData.dispose()
  }
}
