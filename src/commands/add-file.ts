import * as vscode from 'vscode'

import { StackProvider } from '../providers'

export function registerAddFileCommand(context: vscode.ExtensionContext, stackProvider: StackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addCurrentFile', () => {
    const editor = vscode.window.activeTextEditor

    if (editor) {
      stackProvider.addFile(editor.document.uri)
      vscode.window.showInformationMessage('Added current file to stack')
    } else {
      vscode.window.showWarningMessage('No file open')
    }
  })

  context.subscriptions.push(command)
}
