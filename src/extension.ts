import * as vscode from 'vscode'

import { registerAllCommands } from './commands'
import { ContextStackProvider, IgnorePatternProvider } from './providers'
import { Logger } from './utils'

export function activate(context: vscode.ExtensionContext) {
  Logger.configure('AI Context Stacker')
  Logger.info('Extension is activating...')

  const contextStackProvider = new ContextStackProvider()
  const ignorePatternProvider = new IgnorePatternProvider()

  const treeView = vscode.window.createTreeView('aiContextStackerView', {
    treeDataProvider: contextStackProvider,
  })
  context.subscriptions.push(treeView)
  context.subscriptions.push(contextStackProvider)
  context.subscriptions.push(ignorePatternProvider)

  registerAllCommands({ context, contextStackProvider, ignorePatternProvider })

  Logger.info('Extension is activated')
}

export function deactivate() {
  Logger.info('Extension is deactivating...')
  Logger.dispose()
}
