import * as vscode from 'vscode'

import { StackProvider } from '../providers'
import { ErrorHandler } from '../utils'
import { generateContext } from './copy-all'

export function registerCopyAndClearCommand(context: vscode.ExtensionContext, stackProvider: StackProvider): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.copyAndClear',
    ErrorHandler.safeExecute('Copy and Clear', async () => {
      await handleCopyAndClear(stackProvider)
    }),
  )

  context.subscriptions.push(command)
}

async function handleCopyAndClear(provider: StackProvider): Promise<void> {
  const files = provider.getFiles()

  if (files.length === 0) {
    void vscode.window.showInformationMessage('Context stack is empty.')
    return
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Copying & Clearing Stack...',
      cancellable: true,
    },
    async (_, token) => {
      const content = await generateContext(files, token)

      if (content !== undefined) {
        await vscode.env.clipboard.writeText(content)

        provider.clear()

        vscode.window.showInformationMessage(`Copied and cleared ${files.length} file(s)`)
      }
    },
  )
}
