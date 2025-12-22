import * as vscode from 'vscode'

import { StackProvider } from '../providers'
import { ClipboardOps, ErrorHandler } from '../utils'

/**
 * Command: aiContextStacker.copyAll
 * Copies all staged files in the current stack to the clipboard.
 */
export function registerCopyAllCommand(context: vscode.ExtensionContext, stackProvider: StackProvider): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.copyAll',
    ErrorHandler.safeExecute('Copy All Files', async () => {
      await handleCopyAll(stackProvider)
    }),
  )

  context.subscriptions.push(command)
}

async function handleCopyAll(provider: StackProvider): Promise<void> {
  const files = provider.getFiles()

  if (files.length === 0) {
    vscode.window.showInformationMessage('Context stack is empty. Add files first.')
    return
  }

  // Use the shared ClipboardOps utility for consistent behavior
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Building AI Context...',
      cancellable: false,
    },
    async () => {
      await ClipboardOps.copy(files, `${files.length} files`)
    },
  )
}
