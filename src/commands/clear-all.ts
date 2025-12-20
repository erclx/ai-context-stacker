import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'

export function registerClearAllCommand(
  extensionContext: vscode.ExtensionContext,
  contextStackProvider: ContextStackProvider,
): void {
  const command = vscode.commands.registerCommand('aiContextStacker.clearAll', async () => {
    const files = contextStackProvider.getFiles()
    if (files.length === 0) {
      vscode.window.showInformationMessage('Context stack is already empty')
      return
    }

    const unpinnedCount = files.filter((f) => !f.isPinned).length
    const pinnedCount = files.length - unpinnedCount

    if (unpinnedCount === 0) {
      vscode.window.showInformationMessage('All files are pinned. Unpin them to clear.')
      return
    }

    const message =
      pinnedCount > 0
        ? `Clear ${unpinnedCount} unpinned file(s)? (${pinnedCount} pinned files will remain)`
        : `Clear all ${files.length} file(s) from context stack?`

    const answer = await vscode.window.showWarningMessage(message, { modal: true }, 'Confirm')

    if (answer === 'Confirm') {
      contextStackProvider.clear()
      vscode.window.showInformationMessage('Context stack cleared')
    }
  })

  extensionContext.subscriptions.push(command)
}
