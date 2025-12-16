import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'
import { ContentFormatter, Logger, TokenEstimator } from '../utils'

/**
 * Registers the command to copy the entire context stack to the clipboard.
 * This is the main action triggered by the status bar item.
 *
 * @param context The extension context.
 * @param provider The ContextStackProvider instance.
 */
export function registerCopyAllCommand(context: vscode.ExtensionContext, provider: ContextStackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.copyAll', async () => {
    const files = provider.getFiles()

    if (files.length === 0) {
      vscode.window.showInformationMessage('Context stack is empty. Add files first.')
      return
    }

    // Wrap the file reading/formatting process in a progress notification
    // to give the user feedback during potentially slow I/O operations.
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

        const stats = TokenEstimator.measure(formattedContent)

        Logger.info(`Copied ${files.length} files. Stats: ${stats.tokenCount} tokens, ${duration}ms`)

        vscode.window.showInformationMessage(`Copied ${files.length} files! (${TokenEstimator.format(stats)})`)
      },
    )
  })

  context.subscriptions.push(command)
}
