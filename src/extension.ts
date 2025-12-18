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
  const contextStackProvider = new ContextStackProvider(context, ignorePatternProvider)

  // Restore persisted state
  restoreState(context, contextStackProvider)

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

/**
 * Rehydrates the context stack from workspace state.
 */
function restoreState(context: vscode.ExtensionContext, provider: ContextStackProvider): void {
  const storedUris = context.workspaceState.get<string[]>(ContextStackProvider.STORAGE_KEY) || []

  if (storedUris.length === 0) return

  const urisToRestore = storedUris
    .map((uriStr) => {
      try {
        return vscode.Uri.parse(uriStr)
      } catch {
        return null
      }
    })
    .filter((uri): uri is vscode.Uri => uri !== null)

  if (urisToRestore.length > 0) {
    provider.addFiles(urisToRestore)
    Logger.info(`Restored ${urisToRestore.length} files from workspace state.`)
  }
}

export function deactivate() {
  Logger.info('Extension is deactivating...')
  Logger.dispose()
}
