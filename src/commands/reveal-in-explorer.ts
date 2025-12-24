import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem } from '../models'
import { Logger } from '../utils'

/**
 * Registers the 'Reveal in Explorer' command.
 * Allows users to jump from the Staged Files view to the system/VS Code explorer.
 */
export function registerRevealInExplorerCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.revealInExplorer', (item?: StackTreeItem) => {
      void handleReveal(item)
    }),
  )
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
    // Folders use resourceUri
    return item.resourceUri
  }
  // Files use uri
  return item.uri
}
