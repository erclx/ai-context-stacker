import * as vscode from 'vscode'

import { ContextStackProvider } from '@/providers'
import { ContentFormatter, Logger, TokenEstimator } from '@/utils'

export function registerCopyAllCommand(context: vscode.ExtensionContext, provider: ContextStackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.copyAll', async () => {
    const files = provider.getFiles()

    if (files.length === 0) {
      vscode.window.showInformationMessage('Context stack is empty. Add files first.')
      return
    }

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

        // Measure stats
        const stats = TokenEstimator.measure(formattedContent)

        Logger.info(`Copied ${files.length} files. Stats: ${stats.tokenCount} tokens, ${duration}ms`)

        vscode.window.showInformationMessage(`Copied ${files.length} files! (${TokenEstimator.format(stats)})`)
      },
    )
  })

  context.subscriptions.push(command)
}
