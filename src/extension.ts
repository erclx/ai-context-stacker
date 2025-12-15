import * as vscode from 'vscode'

import {
  registerAddFileCommand,
  registerAddFilePickerCommand,
  registerClearAllCommand,
  registerRemoveFileCommand,
} from './commands'
import { ContextStackProvider, IgnorePatternProvider } from './providers'

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
  console.log('AI Context Stacker is activating...')

  const contextStackProvider = new ContextStackProvider()
  const ignorePatternProvider = new IgnorePatternProvider()
  const providers = { contextStackProvider, ignorePatternProvider }

  const treeView = vscode.window.createTreeView('aiContextStackerView', {
    treeDataProvider: contextStackProvider,
  })
  context.subscriptions.push(treeView)
  context.subscriptions.push(ignorePatternProvider)

  registerAllCommands(context, providers)

  console.log('AI Context Stacker activated!')
}

export function deactivate() {}
