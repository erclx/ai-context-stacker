import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'
import { ClipboardOps, ErrorHandler } from '../utils'

/**
 * Command: aiContextStacker.copyAll
 * Copies all staged files in the current stack to the clipboard.
 */
export function registerCopyAllCommand(
  extensionContext: vscode.ExtensionContext,
  contextStackProvider: ContextStackProvider,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.copyAll',
    ErrorHandler.safeExecute('Copy All Files', async () => {
      await handleCopyAll(contextStackProvider)
    }),
  )

  extensionContext.subscriptions.push(command)
}

async function handleCopyAll(provider: ContextStackProvider): Promise<void> {
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
