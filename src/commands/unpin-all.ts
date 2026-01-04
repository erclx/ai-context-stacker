import * as vscode from 'vscode'

import { Logger } from '../utils'
import { Command, CommandDependencies } from './types'

export function getUnpinAllCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.unpinAll',
      execute: async () => {
        try {
          deps.services.trackManager.unpinAllInActive()
          deps.services.stackProvider.resort()
          vscode.window.setStatusBarMessage('$(pinned) Unpinned all files', 2000)
        } catch (error) {
          Logger.error('Failed to unpin all files', error)
        }
      },
    },
  ]
}
