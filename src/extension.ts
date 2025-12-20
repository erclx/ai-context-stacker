import * as vscode from 'vscode'

import { registerAllCommands } from './commands'
import { ServiceRegistry } from './services'
import { PreviewWebview, PreviewWebviewSerializer, StackerStatusBar, ViewManager } from './ui'
import { Logger } from './utils'

export function activate(context: vscode.ExtensionContext) {
  Logger.configure('AI Context Stacker')
  Logger.info('Extension is activating...')

  const services = new ServiceRegistry(context)
  services.register(context.subscriptions)

  const views = new ViewManager(services.contextStackProvider, services.trackListProvider, services.contextTrackManager)
  context.subscriptions.push(views)

  const statusBar = new StackerStatusBar(context, services.contextStackProvider)
  context.subscriptions.push(statusBar)

  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(
      PreviewWebview.viewType,
      new PreviewWebviewSerializer(context.extensionUri, services.contextStackProvider),
    ),
  )

  registerAllCommands({
    context,
    services,
    views,
  })

  Logger.info('Extension is activated')
}

export function deactivate() {
  Logger.info('Extension is deactivating...')
  Logger.dispose()
}
