import * as vscode from 'vscode'

import { StackTreeItem } from '../models'
import { ContextStackProvider } from '../providers'
import { ContentFormatter, Logger, SelectionResolver, TokenEstimator } from '../utils'

/**
 * Command: aiContextStacker.copyFile
 * Copies selected files (or all files) to clipboard with markdown formatting.
 */
export function registerCopyFileCommand(
  extensionContext: vscode.ExtensionContext,
  contextStackProvider: ContextStackProvider,
  filesView: vscode.TreeView<StackTreeItem>,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.copyFile',
    async (item?: StackTreeItem, selectedItems?: StackTreeItem[]) => {
      // 1. Resolve Targets
      const filesToCopy = SelectionResolver.resolve(item, selectedItems, filesView, contextStackProvider)

      if (filesToCopy.length === 0) {
        vscode.window.showInformationMessage('Context stack is empty.')
        return
      }

      // 2. Execute with Progress Feedback
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Copying files...',
          cancellable: false,
        },
        async () => {
          try {
            // 3. Format Content
            const formattedContent = await ContentFormatter.format(filesToCopy)

            if (!formattedContent) {
              vscode.window.showWarningMessage('Selected content is empty or binary.')
              return
            }

            // 4. Write to Clipboard
            await vscode.env.clipboard.writeText(formattedContent)

            // 5. Notify User
            const stats = TokenEstimator.measure(formattedContent)
            const label = SelectionResolver.getFeedbackLabel(filesToCopy, contextStackProvider.getFiles().length)

            Logger.info(`Copied: ${label}`)
            vscode.window.showInformationMessage(`Copied ${label}! (${TokenEstimator.format(stats)})`)

            // Implicit selection feedback (Status Bar)
            const isImplicit =
              !item && (!selectedItems || selectedItems.length === 0) && filesView.selection.length === 0

            if (isImplicit) {
              vscode.window.setStatusBarMessage('Nothing selected. Copied entire stack.', 3000)
            }
          } catch (error) {
            Logger.error('Copy failed', error)
            vscode.window.showErrorMessage('Failed to copy files.')
          }
        },
      )
    },
  )

  extensionContext.subscriptions.push(command)
}
