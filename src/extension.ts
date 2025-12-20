import * as vscode from 'vscode'

import { registerAllCommands } from './commands'
import { ContextStackProvider, ContextTrackManager, IgnorePatternProvider } from './providers'
import { TrackListProvider } from './providers/track-list-provider'
import { FileWatcherService } from './services'
import { PreviewWebview, PreviewWebviewSerializer, StackerStatusBar } from './ui'
import { Logger } from './utils'

export function activate(context: vscode.ExtensionContext) {
  Logger.configure('AI Context Stacker')
  Logger.info('Extension is activating...')

  const ignorePatternProvider = new IgnorePatternProvider()
  const contextTrackManager = new ContextTrackManager(context)
  const fileWatcher = new FileWatcherService(contextTrackManager)

  const contextStackProvider = new ContextStackProvider(context, ignorePatternProvider, contextTrackManager)
  const trackListProvider = new TrackListProvider(contextTrackManager)

  // Wire up for live token stats display
  trackListProvider.setStackProvider(contextStackProvider)

  const filesView = vscode.window.createTreeView('aiContextStackerView', {
    treeDataProvider: contextStackProvider,
    dragAndDropController: contextStackProvider,
    canSelectMany: true,
  })

  const tracksView = vscode.window.createTreeView('aiContextTracksView', {
    treeDataProvider: trackListProvider,
    canSelectMany: false,
  })

  updateTitle(filesView, contextTrackManager.getActiveTrack().name)
  contextTrackManager.onDidChangeTrack((track) => {
    updateTitle(filesView, track.name)
  })

  const statusBar = new StackerStatusBar(context, contextStackProvider)

  // Register webview serializer for persistence across reloads
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(
      PreviewWebview.viewType,
      new PreviewWebviewSerializer(context.extensionUri, contextStackProvider),
    ),
  )

  context.subscriptions.push(
    filesView,
    tracksView,
    contextStackProvider,
    trackListProvider,
    ignorePatternProvider,
    contextTrackManager,
    statusBar,
    fileWatcher,
  )

  registerAllCommands({
    extensionContext: context,
    contextStackProvider,
    ignorePatternProvider,
    filesView,
    contextTrackManager,
    tracksView,
  })

  Logger.info('Extension is activated')
}

function updateTitle(treeView: vscode.TreeView<any>, trackName: string) {
  treeView.title = `Staged Files — ${trackName}`
}

export function deactivate() {
  Logger.info('Extension is deactivating...')
  Logger.dispose()
}
