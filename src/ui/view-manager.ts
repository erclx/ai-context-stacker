import * as vscode from 'vscode'

import { ContextTrack, StackTreeItem } from '../models'
import { IgnoreManager, StackProvider, TrackManager } from '../providers'
import { TrackProvider } from '../providers/track-provider'
import { StackDragDropController } from './stack-drag-drop'

/**
 * Manages the creation, configuration, and state synchronization of VS Code TreeViews.
 */
export class ViewManager implements vscode.Disposable {
  public readonly filesView: vscode.TreeView<StackTreeItem>
  public readonly tracksView: vscode.TreeView<ContextTrack>

  private _disposables: vscode.Disposable[] = []

  constructor(
    stackProvider: StackProvider,
    trackListProvider: TrackProvider,
    trackManager: TrackManager,
    ignoreProvider: IgnoreManager,
  ) {
    // Composition Root: Wire Controller to Provider
    const dragDropController = new StackDragDropController(stackProvider, ignoreProvider)

    this.filesView = vscode.window.createTreeView('aiContextStackerView', {
      treeDataProvider: stackProvider,
      dragAndDropController: dragDropController,
      canSelectMany: true,
    })

    this.tracksView = vscode.window.createTreeView('aiContextTracksView', {
      treeDataProvider: trackListProvider,
      dragAndDropController: trackListProvider,
      canSelectMany: false,
    })

    this.registerViewCommands()
    this.updateTitle(trackManager.getActiveTrack().name, stackProvider)

    // Listen for Track Changes
    trackManager.onDidChangeTrack((track) => this.updateTitle(track.name, stackProvider), null, this._disposables)

    // Listen for Filter Changes (Provider emits on filter change)
    stackProvider.onDidChangeTreeData(
      () => this.updateTitle(trackManager.getActiveTrack().name, stackProvider),
      null,
      this._disposables,
    )

    this._disposables.push(this.filesView, this.tracksView, dragDropController)
  }

  /**
   * Registers view-specific commands that proxy to internal Workbench actions.
   */
  private registerViewCommands(): void {
    const collapseCmd = vscode.commands.registerCommand('aiContextStacker.collapseAll', () =>
      // Proxy to the internal VS Code command to handle recursive collapsing
      vscode.commands.executeCommand('workbench.actions.treeView.aiContextStackerView.collapseAll'),
    )

    this._disposables.push(collapseCmd)
  }

  private updateTitle(trackName: string, provider: StackProvider) {
    const baseTitle = `Staged Files — ${trackName}`

    if (provider.hasActiveFilters) {
      this.filesView.title = `${baseTitle} (Pinned Only)`
    } else {
      this.filesView.title = baseTitle
    }
  }

  public dispose() {
    this._disposables.forEach((d) => d.dispose())
  }
}
