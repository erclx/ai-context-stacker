import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'
import { PreviewWebview } from '../ui/preview-webview'

/**
 * Opens a Webview Panel displaying the formatted context stack.
 */
export function registerPreviewContextCommand(
  extensionContext: vscode.ExtensionContext,
  contextStackProvider: ContextStackProvider,
): void {
  const command = vscode.commands.registerCommand('aiContextStacker.previewContext', () => {
    PreviewWebview.createOrShow(extensionContext.extensionUri, contextStackProvider)
  })

  extensionContext.subscriptions.push(command)
}
