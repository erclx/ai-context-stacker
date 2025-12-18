import * as vscode from 'vscode'

import { registerAllCommands } from './commands'
import { ContextStackProvider, IgnorePatternProvider } from './providers'
import { StackerStatusBar } from './ui'
import { Logger } from './utils'

/**
 * Main entry point for the extension.
 * Orchestrates provider initialization and UI registration.
 */
export function activate(context: vscode.ExtensionContext) {
  Logger.configure('AI Context Stacker')
  Logger.info('Extension is activating...')

  const ignorePatternProvider = new IgnorePatternProvider()
  const contextStackProvider = new ContextStackProvider(ignorePatternProvider)

  const treeView = vscode.window.createTreeView('aiContextStackerView', {
    treeDataProvider: contextStackProvider,
    dragAndDropController: contextStackProvider,
    canSelectMany: true,
  })

  const statusBar = new StackerStatusBar(context, contextStackProvider)

  context.subscriptions.push(treeView, contextStackProvider, ignorePatternProvider, statusBar)

  registerAllCommands({
    context,
    contextStackProvider,
    ignorePatternProvider,
    treeView,
  })

  Logger.info('Extension is activated')
}

export function deactivate() {
  Logger.info('Extension is deactivating...')
  Logger.dispose()
}
