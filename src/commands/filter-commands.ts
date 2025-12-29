import * as vscode from 'vscode'

import { StackProvider } from '../providers'
import { Command, CommandDependencies } from './types'

export function getFilterCommands(deps: CommandDependencies): Command[] {
  const toggleLogic = () => handleTogglePinned(deps.services.stackProvider)

  return [
    {
      id: 'aiContextStacker.showPinnedOnly',
      execute: toggleLogic,
    },
    {
      id: 'aiContextStacker.showAllFiles',
      execute: toggleLogic,
    },
  ]
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
