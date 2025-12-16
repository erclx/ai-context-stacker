import * as vscode from 'vscode'

import { registerAllCommands } from './commands'
import { ContextStackProvider, HelpProvider, IgnorePatternProvider } from './providers'
import { StackerStatusBar } from './ui'
import { Logger } from './utils'

/**
 * Main entry point of the VS Code extension.
 * Initializes core components, registers UI elements, and sets up commands.
 *
 * @param context The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext) {
  Logger.configure('AI Context Stacker')
  Logger.info('Extension is activating...')

  // Initialize data providers and services
  const contextStackProvider = new ContextStackProvider()
  const ignorePatternProvider = new IgnorePatternProvider()
  const helpProvider = new HelpProvider()

  // Create the main TreeView for staged files
  const treeView = vscode.window.createTreeView('aiContextStackerView', {
    treeDataProvider: contextStackProvider,
    canSelectMany: true,
  })

  // Create the secondary TreeView for help/instructions
  const helpTreeView = vscode.window.createTreeView('aiContextStackerHelpView', {
    treeDataProvider: helpProvider,
  })

  // Initialize the status bar item that shows staged file count and copy command
  const statusBar = new StackerStatusBar(context, contextStackProvider)

  // Register all disposable items to be cleaned up when the extension is deactivated
  context.subscriptions.push(treeView)
  context.subscriptions.push(helpTreeView)
  context.subscriptions.push(contextStackProvider)
  context.subscriptions.push(ignorePatternProvider)
  context.subscriptions.push(statusBar)

  // Register all extension commands and inject necessary dependencies
  registerAllCommands({ context, contextStackProvider, ignorePatternProvider, treeView })

  Logger.info('Extension is activated')
}

/**
 * Clean up resources when the extension is deactivated.
 */
export function deactivate() {
  Logger.info('Extension is deactivating...')
  // Ensure the output channel is closed and disposed to prevent resource leaks
  Logger.dispose()
}
