import * as vscode from 'vscode'

import { type StagedFile } from '@/models'
import { ContextStackProvider } from '@/providers'
import { ContentFormatter, Logger, TokenEstimator } from '@/utils'

export function registerCopyFileCommand(
  context: vscode.ExtensionContext,
  provider: ContextStackProvider,
  treeView: vscode.TreeView<StagedFile>,
): void {
  const command = vscode.commands.registerCommand('aiContextStacker.copyFile', async (item?: StagedFile) => {
    let filesToCopy: StagedFile[] = []

    if (item) {
      filesToCopy = [item]
    } else if (treeView.selection.length > 0) {
      filesToCopy = [treeView.selection[0]]
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
        vscode.window.showWarningMessage('Content is empty or binary.')
        return
      }

      await vscode.env.clipboard.writeText(formattedContent)

      const stats = TokenEstimator.measure(formattedContent)
      const label = filesToCopy.length === 1 ? filesToCopy[0].label : 'All Staged Files'

      Logger.info(`Smart Copy: ${label}`)
      vscode.window.showInformationMessage(`Copied ${label}! (${TokenEstimator.format(stats)})`)
    } catch (error) {
      Logger.error('Smart Copy failed', error)
      vscode.window.showErrorMessage('Failed to copy content.')
    }
  })

  context.subscriptions.push(command)
}
