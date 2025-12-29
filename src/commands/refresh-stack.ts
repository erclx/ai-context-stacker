import * as vscode from 'vscode'

import { Logger } from '../utils'
import { Command, CommandDependencies } from './types'

export function getRefreshStackCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.refreshStack',
      execute: async () => {
        try {
          await deps.services.stackProvider.reScanFileSystem()
          vscode.window.setStatusBarMessage('$(check) AI Context Stack refreshed', 3000)
        } catch (error) {
          Logger.error('Failed to refresh stack', error as Error)
          void vscode.window.showErrorMessage('Failed to refresh context stack. Check output logs.')
        }
      },
    },
  ]
}
