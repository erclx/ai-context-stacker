import * as vscode from 'vscode'

import { Logger } from '../utils'
import { Command, CommandDependencies } from './types'

export function getOpenSettingsCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.openSettings',
      execute: async () => {
        try {
          await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:erclx.ai-context-stacker')
        } catch (error) {
          Logger.error('Failed to open settings UI', error)
        }
      },
    },
  ]
}
