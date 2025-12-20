import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'
import { PreviewWebview } from '../ui/preview-webview'

/**
 * Opens a Webview Panel displaying the formatted context stack.
 */
export function registerPreviewContextCommand(context: vscode.ExtensionContext, provider: ContextStackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.previewContext', () => {
    PreviewWebview.createOrShow(context.extensionUri, provider)
  })

  context.subscriptions.push(command)
}
