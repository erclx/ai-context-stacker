import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem } from '../models'
import { Logger } from '../utils'
import { Command, CommandDependencies } from './types'

export function getRevealInExplorerCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.revealInExplorer',
      execute: (item?: StackTreeItem) => {
        void handleReveal(item)
      },
    },
  ]
}

async function handleReveal(item?: StackTreeItem): Promise<void> {
  if (!item) return

  try {
    const uri = resolveUri(item)
    if (!uri) {
      void vscode.window.showWarningMessage('Cannot reveal this item in Explorer.')
      return
    }

    await vscode.commands.executeCommand('revealInExplorer', uri)
  } catch (error) {
    Logger.error('Failed to reveal item in explorer', error as Error)
  }
}

function resolveUri(item: StackTreeItem): vscode.Uri | undefined {
  if (isStagedFolder(item)) {
    return item.resourceUri
  }
  return item.uri
}
