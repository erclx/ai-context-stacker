import * as vscode from 'vscode'

import { registerAllCommands } from './commands'
import { ContextStackProvider, ContextTrackManager, IgnorePatternProvider } from './providers'
import { StackerStatusBar } from './ui'
import { Logger } from './utils'

export function activate(context: vscode.ExtensionContext) {
  Logger.configure('AI Context Stacker')
  Logger.info('Extension is activating...')

  const ignorePatternProvider = new IgnorePatternProvider()
  const trackManager = new ContextTrackManager(context)

  const contextStackProvider = new ContextStackProvider(context, ignorePatternProvider, trackManager)

  const treeView = vscode.window.createTreeView('aiContextStackerView', {
    treeDataProvider: contextStackProvider,
    dragAndDropController: contextStackProvider,
    canSelectMany: true,
  })

  // Sets the title immediately on load: "Staged Files — Main"
  updateTitle(treeView, trackManager.getActiveTrack().name)

  // Updates the title whenever the track switches or is renamed
  trackManager.onDidChangeTrack((track) => {
    updateTitle(treeView, track.name)
  })

  const statusBar = new StackerStatusBar(context, contextStackProvider)

  context.subscriptions.push(treeView, contextStackProvider, ignorePatternProvider, trackManager, statusBar)

  registerAllCommands({
    context,
    contextStackProvider,
    ignorePatternProvider,
    treeView,
    trackManager,
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
