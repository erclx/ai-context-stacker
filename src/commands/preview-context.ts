import * as vscode from 'vscode'

import { StackProvider } from '../providers'
import { PreviewWebview } from '../ui/preview-webview'

export function registerPreviewContextCommand(context: vscode.ExtensionContext, stackProvider: StackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.previewContext', () => {
    if (stackProvider.getFiles().length === 0) {
      void vscode.window.showWarningMessage('No files in stack to preview.')
      return
    }

    PreviewWebview.createOrShow(context.extensionUri, stackProvider)
  })

  context.subscriptions.push(command)
}
