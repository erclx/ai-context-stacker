import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'

export function registerAddFileCommand(
  extensionContext: vscode.ExtensionContext,
  contextProvider: ContextStackProvider,
): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addCurrentFile', () => {
    const editor = vscode.window.activeTextEditor

    if (editor) {
      contextProvider.addFile(editor.document.uri)
      vscode.window.showInformationMessage('Added current file to stack')
    } else {
      vscode.window.showWarningMessage('No file open')
    }
  })

  extensionContext.subscriptions.push(command)
}
