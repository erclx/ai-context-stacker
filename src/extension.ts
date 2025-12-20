import * as vscode from 'vscode'

import { registerAllCommands } from './commands'
import { ContextStackProvider, ContextTrackManager, IgnorePatternProvider } from './providers'
import { TrackListProvider } from './providers/track-list-provider'
import { FileWatcherService } from './services'
import { StackerStatusBar } from './ui'
import { Logger } from './utils'

export function activate(context: vscode.ExtensionContext) {
  Logger.configure('AI Context Stacker')
  Logger.info('Extension is activating...')

  const ignorePatternProvider = new IgnorePatternProvider()
  const trackManager = new ContextTrackManager(context)

  // Initialize File Watcher
  const fileWatcher = new FileWatcherService(trackManager)

  // -- Providers --
  const contextStackProvider = new ContextStackProvider(context, ignorePatternProvider, trackManager)
  const trackListProvider = new TrackListProvider(trackManager)

  // Link providers for token stats display
  trackListProvider.setStackProvider(contextStackProvider)

  // -- Views --
  const filesView = vscode.window.createTreeView('aiContextStackerView', {
    treeDataProvider: contextStackProvider,
    dragAndDropController: contextStackProvider,
    canSelectMany: true,
  })

  const tracksView = vscode.window.createTreeView('aiContextTracksView', {
    treeDataProvider: trackListProvider,
    canSelectMany: false,
  })

  // Dynamic Title Updates
  updateTitle(filesView, trackManager.getActiveTrack().name)
  trackManager.onDidChangeTrack((track) => {
    updateTitle(filesView, track.name)
  })

  const statusBar = new StackerStatusBar(context, contextStackProvider)

  // Add all disposables
  context.subscriptions.push(
    filesView,
    tracksView,
    contextStackProvider,
    trackListProvider,
    ignorePatternProvider,
    trackManager,
    statusBar,
    fileWatcher,
  )

  registerAllCommands({
    context,
    contextStackProvider,
    ignorePatternProvider,
    filesView,
    trackManager,
    tracksView,
  })

  Logger.info('Extension is activated')
}

/**
 * Updates the TreeView title to reflect the active track.
 * e.g., "Staged Files — Refactor-Auth"
 */
function updateTitle(treeView: vscode.TreeView<any>, trackName: string) {
  treeView.title = `Staged Files — ${trackName}`
}

export function deactivate() {
  Logger.info('Extension is deactivating...')
  Logger.dispose()
}
