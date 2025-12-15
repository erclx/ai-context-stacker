import * as vscode from 'vscode'

import { ContextStackProvider } from '@/providers'

export function registerClearAllCommand(context: vscode.ExtensionContext, provider: ContextStackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.clearAll', async () => {
    const files = provider.getFiles()

    if (files.length === 0) {
      vscode.window.showInformationMessage('Context stack is already empty')
      return
    }

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
