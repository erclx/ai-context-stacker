import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'

/**
 * Registers the command to add the currently active file in the editor to the stack.
 *
 * @param extensionContext The extension context.
 * @param contextProvider The ContextStackProvider instance.
 */
export function registerAddFileCommand(
  extensionContext: vscode.ExtensionContext,
  contextProvider: ContextStackProvider,
): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addCurrentFile', () => {
    const editor = vscode.window.activeTextEditor

    if (editor) {
      // Use the document's URI, which is the canonical identifier for the file
      contextProvider.addFile(editor.document.uri)
      vscode.window.showInformationMessage('Added current file to stack')
    } else {
      vscode.window.showWarningMessage('No file open')
    }
  })

  extensionContext.subscriptions.push(command)
}
