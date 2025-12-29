import * as vscode from 'vscode'

import { Command, CommandDependencies } from './types'

export function getSelectAllCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.selectAll',
      execute: async () => {
        await vscode.commands.executeCommand('list.selectAll')
      },
    },
  ]
}
