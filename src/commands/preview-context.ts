import * as vscode from 'vscode'

import { StackProvider } from '../providers'
import { PreviewWebview } from '../ui/preview-webview'

export function registerPreviewContextCommand(context: vscode.ExtensionContext, stackProvider: StackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.previewContext', () => {
    PreviewWebview.createOrShow(context.extensionUri, stackProvider)
  })

  context.subscriptions.push(command)
}
