import * as vscode from 'vscode'

import { registerAllCommands } from './commands'
import { ServiceRegistry } from './services'
import { PreviewWebview, PreviewWebviewSerializer, StackerStatusBar, ViewManager } from './ui'
import { Logger } from './utils'

export async function activate(context: vscode.ExtensionContext): Promise<ServiceRegistry> {
  ServiceRegistry.disposeExisting()

  Logger.configure('AI Context Stacker')
  Logger.info('Activation sequence started.')

  const services = new ServiceRegistry(context)
  services.register()

  const views = new ViewManager(
    services.stackProvider,
    services.trackProvider,
    services.trackManager,
    services.ignoreManager,
    services.analysisEngine,
  )

  const statusBar = new StackerStatusBar(context, services.stackProvider)

  registerSubscriptions(context, views, statusBar, services)
  registerCommands(context, services, views)

  Logger.info('Activation sequence complete.')
  return services
}

function registerSubscriptions(
  context: vscode.ExtensionContext,
  views: ViewManager,
  statusBar: StackerStatusBar,
  services: ServiceRegistry,
): void {
  context.subscriptions.push(views, statusBar)

  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(
      PreviewWebview.viewType,
      new PreviewWebviewSerializer(context.extensionUri, services.stackProvider),
    ),
  )
}

function registerCommands(context: vscode.ExtensionContext, services: ServiceRegistry, views: ViewManager): void {
  registerAllCommands({ context, services, views })
}

export function deactivate(): void {
  ServiceRegistry.disposeExisting()
  Logger.dispose()
}
