import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'

/**
 * Registers the command to clear all files from the context stack, prompting for confirmation.
 *
 * @param context The extension context.
 * @param provider The ContextStackProvider instance.
 */
export function registerClearAllCommand(context: vscode.ExtensionContext, provider: ContextStackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.clearAll', async () => {
    const files = provider.getFiles()

    if (files.length === 0) {
      vscode.window.showInformationMessage('Context stack is already empty')
      return
    }

    // Use a modal warning to ensure the user confirms the destructive action
    const answer = await vscode.window.showWarningMessage(
      `Clear all ${files.length} file(s) from context stack?`,
      { modal: true },
      'Confirm',
    )

    if (answer === 'Confirm') {
      provider.clear()
      vscode.window.showInformationMessage('Context stack cleared')
    }
  })

  context.subscriptions.push(command)
}
