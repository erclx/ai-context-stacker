import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { StackProvider } from '../providers'
import { ClipboardOps, ContentFormatter, ErrorHandler } from '../utils'
import { Command, CommandDependencies } from './types'

export function getCopyAllCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.copyAll',
      execute: ErrorHandler.safeExecute('Copy All Files', async () => {
        await handleCopyAll(deps.services.stackProvider)
      }),
    },
  ]
}

async function handleCopyAll(provider: StackProvider): Promise<void> {
  const files = provider.getFiles() as StagedFile[]

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
      const result = await generateContext(files, token)

      if (result !== undefined) {
        await ClipboardOps.copyText(result, `${files.length} files`)
      }
    },
  )
}

export async function generateContext(files: any[], token: vscode.CancellationToken): Promise<string | undefined> {
  let finalOutput = ''

  for await (const chunk of ContentFormatter.formatStream(files, { token })) {
    if (token.isCancellationRequested) return undefined
    finalOutput += chunk
  }

  return token.isCancellationRequested ? undefined : finalOutput
}
