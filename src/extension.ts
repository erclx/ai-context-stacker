import * as vscode from 'vscode'

import { registerAllCommands } from './commands'
import { ContextStackProvider, HelpProvider, IgnorePatternProvider } from './providers'
import { StackerStatusBar } from './ui'
import { Logger } from './utils'

export function activate(context: vscode.ExtensionContext) {
  Logger.configure('AI Context Stacker')
  Logger.info('Extension is activating...')

  const contextStackProvider = new ContextStackProvider()
  const ignorePatternProvider = new IgnorePatternProvider()
  const helpProvider = new HelpProvider()

  const treeView = vscode.window.createTreeView('aiContextStackerView', {
    treeDataProvider: contextStackProvider,
    canSelectMany: true,
  })

  const helpTreeView = vscode.window.createTreeView('aiContextStackerHelpView', {
    treeDataProvider: helpProvider,
  })

  const statusBar = new StackerStatusBar(context, contextStackProvider)

  context.subscriptions.push(treeView)
  context.subscriptions.push(helpTreeView)
  context.subscriptions.push(contextStackProvider)
  context.subscriptions.push(ignorePatternProvider)
  context.subscriptions.push(statusBar)

  registerAllCommands({ context, contextStackProvider, ignorePatternProvider, treeView })

  Logger.info('Extension is activated')
}

export function deactivate() {
  Logger.info('Extension is deactivating...')
  Logger.dispose()
}
