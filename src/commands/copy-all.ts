import * as vscode from 'vscode'

import { ContextStackProvider } from '@/providers'
import { ContentFormatter, Logger } from '@/utils'

export function registerCopyAllCommand(context: vscode.ExtensionContext, provider: ContextStackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.copyAll', async () => {
    const files = provider.getFiles()

    if (files.length === 0) {
      vscode.window.showInformationMessage('Context stack is empty. Add files first.')
      return
    }

    // Show a progress indicator while reading files (important for large stacks)
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Building AI Context...',
        cancellable: false,
      },
      async () => {
        const startTime = Date.now()

        const formattedContent = await ContentFormatter.format(files)
        await vscode.env.clipboard.writeText(formattedContent)

        const duration = Date.now() - startTime
        const sizeInKb = (formattedContent.length / 1024).toFixed(1)

        Logger.info(`Copied ${files.length} files (${sizeInKb} KB) in ${duration}ms`)
        vscode.window.showInformationMessage(`Copied ${files.length} files to clipboard! (${sizeInKb} KB)`)
      },
    )
  })

  context.subscriptions.push(command)
}
