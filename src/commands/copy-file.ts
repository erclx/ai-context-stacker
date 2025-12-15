import * as vscode from 'vscode'

import { type StagedFile } from '@/models'
import { ContextStackProvider } from '@/providers'
import { ContentFormatter, Logger, TokenEstimator } from '@/utils'

export function registerCopyFileCommand(
  context: vscode.ExtensionContext,
  provider: ContextStackProvider,
  treeView: vscode.TreeView<StagedFile>,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.copyFile',
    async (item?: StagedFile, selectedItems?: StagedFile[]) => {
      let filesToCopy: StagedFile[] = []

      if (selectedItems && selectedItems.length > 0) {
        filesToCopy = selectedItems
      } else if (item) {
        filesToCopy = [item]
      } else if (treeView.selection.length > 0) {
        filesToCopy = [...treeView.selection]
      } else {
        filesToCopy = provider.getFiles()
        if (filesToCopy.length === 0) {
          vscode.window.showInformationMessage('Context stack is empty.')
          return
        }
        vscode.window.setStatusBarMessage('Nothing selected. Copied entire stack.', 3000)
      }

      try {
        const formattedContent = await ContentFormatter.format(filesToCopy)

        if (!formattedContent) {
          vscode.window.showWarningMessage('Selected content is empty or binary.')
          return
        }

        await vscode.env.clipboard.writeText(formattedContent)

        const stats = TokenEstimator.measure(formattedContent)

        let label = ''
        if (filesToCopy.length === provider.getFiles().length && filesToCopy.length > 1) {
          label = 'All Staged Files'
        } else if (filesToCopy.length === 1) {
          label = filesToCopy[0].label
        } else {
          label = `${filesToCopy.length} Files`
        }

        Logger.info(`Copied: ${label}`)
        vscode.window.showInformationMessage(`Copied ${label}! (${TokenEstimator.format(stats)})`)
      } catch (error) {
        Logger.error('Copy failed', error)
        vscode.window.showErrorMessage('Failed to copy files.')
      }
    },
  )

  context.subscriptions.push(command)
}
