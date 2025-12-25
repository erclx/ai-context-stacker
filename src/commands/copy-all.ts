import * as vscode from 'vscode'

import { StackProvider } from '../providers'
import { ClipboardOps, ContentFormatter, ErrorHandler } from '../utils'

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
    void vscode.window.showInformationMessage('Context stack is empty.')
    return
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Building AI Context...',
      cancellable: true,
    },
    async (_, token) => {
      await generateAndCopy(files, token)
    },
  )
}

async function generateAndCopy(files: any[], token: vscode.CancellationToken): Promise<void> {
  let finalOutput = ''
  let fileCount = 0

  // Consume the stream directly to build the clipboard string
  for await (const chunk of ContentFormatter.formatStream(files, { token })) {
    if (token.isCancellationRequested) return
    finalOutput += chunk
    fileCount++ // Heuristic progress
  }

  if (!token.isCancellationRequested) {
    await ClipboardOps.copyText(finalOutput, `${files.length} files`)
  }
}
