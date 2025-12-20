import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { ContextStackProvider } from '../providers'
import { ErrorHandler } from '../utils'

type ClearAction =
  | { type: 'empty'; message: string }
  | { type: 'allPinned'; message: string }
  | { type: 'confirm'; message: string }

export function registerClearAllCommand(
  extensionContext: vscode.ExtensionContext,
  contextStackProvider: ContextStackProvider,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.clearAll',
    ErrorHandler.safeExecute('Clear All', async () => {
      await handleClearAll(contextStackProvider)
    }),
  )

  extensionContext.subscriptions.push(command)
}

async function handleClearAll(provider: ContextStackProvider): Promise<void> {
  const files = provider.getFiles()
  const action = determineClearAction(files)

  if (action.type === 'empty' || action.type === 'allPinned') {
    vscode.window.showInformationMessage(action.message)
    return
  }

  // Handle 'confirm' case
  const answer = await vscode.window.showWarningMessage(action.message, { modal: true }, 'Confirm')

  if (answer === 'Confirm') {
    provider.clear()
    vscode.window.showInformationMessage('Context stack cleared')
  }
}

/**
 * Pure logic helper: Analyzes the file list and decides the appropriate
 * clear action and user message.
 */
function determineClearAction(files: StagedFile[]): ClearAction {
  if (files.length === 0) {
    return { type: 'empty', message: 'Context stack is already empty' }
  }

  const unpinnedCount = files.filter((f) => !f.isPinned).length
  const pinnedCount = files.length - unpinnedCount

  if (unpinnedCount === 0) {
    return {
      type: 'allPinned',
      message: 'All files are pinned. Unpin them to clear.',
    }
  }

  const message =
    pinnedCount > 0
      ? `Clear ${unpinnedCount} unpinned file(s)? (${pinnedCount} pinned files will remain)`
      : `Clear all ${files.length} file(s) from context stack?`

  return { type: 'confirm', message }
}
