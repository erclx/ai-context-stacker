import * as vscode from 'vscode'

import { type StagedFile } from '../models'
import { ContextStackProvider } from '../providers'
import { ContentFormatter, Logger, TokenEstimator } from '../utils'

export function registerCopyFileCommand(
  context: vscode.ExtensionContext,
  provider: ContextStackProvider,
  treeView: vscode.TreeView<StagedFile>,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.copyFile',
    async (item?: StagedFile, selectedItems?: StagedFile[]) => {
      // 1. Resolve Selection
      const filesToCopy = resolveTargetFiles(item, selectedItems, treeView, provider)

      if (filesToCopy.length === 0) {
        vscode.window.showInformationMessage('Context stack is empty.')
        return
      }

      try {
        // 2. Format & Validate
        const formattedContent = await ContentFormatter.format(filesToCopy)

        if (!formattedContent) {
          vscode.window.showWarningMessage('Selected content is empty or binary.')
          return
        }

        // 3. Execute Copy
        await vscode.env.clipboard.writeText(formattedContent)

        // 4. Calculate Stats & Notify
        const stats = TokenEstimator.measure(formattedContent)
        const label = getFeedbackLabel(filesToCopy, provider.getFiles().length)

        Logger.info(`Copied: ${label}`)
        vscode.window.showInformationMessage(`Copied ${label}! (${TokenEstimator.format(stats)})`)

        // Special UI case: if we fell back to copying everything because nothing was selected
        if (!item && (!selectedItems || selectedItems.length === 0) && treeView.selection.length === 0) {
          vscode.window.setStatusBarMessage('Nothing selected. Copied entire stack.', 3000)
        }
      } catch (error) {
        Logger.error('Copy failed', error)
        vscode.window.showErrorMessage('Failed to copy files.')
      }
    },
  )

  context.subscriptions.push(command)
}

/**
 * Determines which files to copy based on context menu args, tree selection,
 * or defaulting to the entire stack.
 */
function resolveTargetFiles(
  clickedItem: StagedFile | undefined,
  multiSelect: StagedFile[] | undefined,
  treeView: vscode.TreeView<StagedFile>,
  provider: ContextStackProvider,
): StagedFile[] {
  if (multiSelect && multiSelect.length > 0) {
    return multiSelect
  }

  if (clickedItem) {
    return [clickedItem]
  }

  if (treeView.selection.length > 0) {
    return [...treeView.selection]
  }

  // Fallback: Copy all files
  return provider.getFiles()
}

/**
 * Generates a human-readable label for the copied content.
 */
function getFeedbackLabel(files: StagedFile[], totalStagedCount: number): string {
  if (files.length === totalStagedCount && files.length > 1) {
    return 'All Staged Files'
  }

  if (files.length === 1) {
    return files[0].label
  }

  return `${files.length} Files`
}
