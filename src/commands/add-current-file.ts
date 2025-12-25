import * as vscode from 'vscode'

import { StackProvider } from '../providers'

export function registerAddCurrentFileCommand(context: vscode.ExtensionContext, stackProvider: StackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addCurrentFile', async () => {
    const editor = vscode.window.activeTextEditor

    if (!editor) {
      void vscode.window.showWarningMessage('No file open')
      return
    }

    const wasAdded = await stackProvider.addFile(editor.document.uri)

    if (wasAdded) {
      void vscode.window.showInformationMessage('Added current file to stack')
    } else {
      void vscode.window.showWarningMessage('File is already in the stack')
    }
  })

  context.subscriptions.push(command)
}
