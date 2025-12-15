import * as vscode from 'vscode'

import { ContextStackProvider } from '@/providers'

export function registerAddFileCommand(context: vscode.ExtensionContext, provider: ContextStackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addCurrentFile', () => {
    const editor = vscode.window.activeTextEditor

    if (editor) {
      provider.addFile(editor.document.uri)
      vscode.window.showInformationMessage('Added current file to stack')
    } else {
      vscode.window.showWarningMessage('No file open')
    }
  })

  context.subscriptions.push(command)
}
