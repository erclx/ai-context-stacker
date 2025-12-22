import * as vscode from 'vscode'

import { registerAllCommands } from './commands'
import { ServiceRegistry } from './services'
import { PreviewWebview, PreviewWebviewSerializer, StackerStatusBar, ViewManager } from './ui'
import { Logger } from './utils'

/**
 * Extension entry point.
 * Initializes DI container, views, and command registration.
 * @returns ServiceRegistry instance for integration testing.
 */
export function activate(context: vscode.ExtensionContext): ServiceRegistry {
  Logger.configure('AI Context Stacker')
  Logger.info('Extension is activating...')

  const services = new ServiceRegistry(context)
  services.register(context.subscriptions)

  const views = new ViewManager(
    services.stackProvider,
    services.trackProvider,
    services.trackManager,
    services.ignoreManager,
  )
  context.subscriptions.push(views)

  const statusBar = new StackerStatusBar(context, services.stackProvider)
  context.subscriptions.push(statusBar)

  // Handle webview revival on restart
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(
      PreviewWebview.viewType,
      new PreviewWebviewSerializer(context.extensionUri, services.stackProvider),
    ),
  )

  registerAllCommands({
    context,
    services,
    views,
  })

  Logger.info('Extension is activated')

  return services
}

export function deactivate() {
  Logger.info('Extension is deactivating...')
  Logger.dispose()
}
