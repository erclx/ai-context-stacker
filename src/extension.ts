import * as vscode from 'vscode'

import {
  registerAddFileCommand,
  registerAddFilePickerCommand,
  registerClearAllCommand,
  registerRemoveFileCommand,
} from './commands'
import { ContextStackProvider, IgnorePatternProvider } from './providers'
import { Logger } from './utils/logger'

interface Providers {
  contextStackProvider: ContextStackProvider
  ignorePatternProvider: IgnorePatternProvider
}

function registerAllCommands(
  context: vscode.ExtensionContext,
  { contextStackProvider, ignorePatternProvider }: Providers,
) {
  registerAddFileCommand(context, contextStackProvider)
  registerAddFilePickerCommand(context, contextStackProvider, ignorePatternProvider)
  registerRemoveFileCommand(context, contextStackProvider)
  registerClearAllCommand(context, contextStackProvider)
}

export function activate(context: vscode.ExtensionContext) {
  Logger.configure('AI Context Stacker')
  Logger.info('Extension is activating...')

  const contextStackProvider = new ContextStackProvider()
  const ignorePatternProvider = new IgnorePatternProvider()
  const providers = { contextStackProvider, ignorePatternProvider }

  const treeView = vscode.window.createTreeView('aiContextStackerView', {
    treeDataProvider: contextStackProvider,
  })
  context.subscriptions.push(treeView)
  context.subscriptions.push(contextStackProvider)
  context.subscriptions.push(ignorePatternProvider)

  registerAllCommands(context, providers)

  Logger.info('Extension is activated')
}

export function deactivate() {
  Logger.info('Extension is deactivating...')
  Logger.dispose()
}
