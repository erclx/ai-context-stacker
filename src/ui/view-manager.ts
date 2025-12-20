import * as vscode from 'vscode'

import { ContextTrack, StackTreeItem } from '../models'
import { ContextStackProvider, ContextTrackManager } from '../providers'
import { TrackListProvider } from '../providers/track-list-provider'

/**
 * Manages the creation, configuration, and state synchronization of VS Code TreeViews.
 */
export class ViewManager implements vscode.Disposable {
  public readonly filesView: vscode.TreeView<StackTreeItem>
  public readonly tracksView: vscode.TreeView<ContextTrack>

  private _disposables: vscode.Disposable[] = []

  constructor(
    stackProvider: ContextStackProvider,
    trackListProvider: TrackListProvider,
    trackManager: ContextTrackManager,
  ) {
    this.filesView = vscode.window.createTreeView('aiContextStackerView', {
      treeDataProvider: stackProvider,
      dragAndDropController: stackProvider,
      canSelectMany: true,
    })

    this.tracksView = vscode.window.createTreeView('aiContextTracksView', {
      treeDataProvider: trackListProvider,
      canSelectMany: false,
    })

    this.updateTitle(trackManager.getActiveTrack().name)

    trackManager.onDidChangeTrack(
      (track) => {
        this.updateTitle(track.name)
      },
      null,
      this._disposables,
    )

    this._disposables.push(this.filesView, this.tracksView)
  }

  private updateTitle(trackName: string) {
    this.filesView.title = `Staged Files — ${trackName}`
  }

  public dispose() {
    this._disposables.forEach((d) => d.dispose())
  }
}
