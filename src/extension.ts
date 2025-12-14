import * as vscode from 'vscode'

import { ContextStackProvider } from '@/providers/context-stack-provider'

import { registerAddFileCommand } from './commands/add-file'

export function activate(context: vscode.ExtensionContext) {
  console.log('AI Context Stacker is activating...')

  const provider = new ContextStackProvider()

  // Register the TreeView
  const treeView = vscode.window.createTreeView('aiContextStackerView', {
    treeDataProvider: provider,
  })
  context.subscriptions.push(treeView)

  // Register commands
  registerAddFileCommand(context, provider)

  console.log('AI Context Stacker activated!')
}

export function deactivate() {}
