import * as vscode from 'vscode'

import { StackProvider } from '../providers'

export function registerFilterCommands(context: vscode.ExtensionContext, provider: StackProvider): void {
  const toggleLogic = () => handleTogglePinned(provider)

  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.showPinnedOnly', toggleLogic),
    vscode.commands.registerCommand('aiContextStacker.showAllFiles', toggleLogic),
  )
}

function handleTogglePinned(provider: StackProvider): void {
  const isPinnedOnly = provider.togglePinnedOnly()

  void vscode.commands.executeCommand('setContext', 'aiContextStacker.pinnedOnly', isPinnedOnly)

  if (isPinnedOnly) {
    void vscode.window.setStatusBarMessage('$(pin) AI Context: Showing Pinned Files Only', 3000)
  } else {
    void vscode.window.setStatusBarMessage('$(list-flat) AI Context: Showing All Files', 3000)
  }
}
