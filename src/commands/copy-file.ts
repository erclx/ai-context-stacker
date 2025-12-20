import * as vscode from 'vscode'

import { type StagedFile } from '../models'
import { ContextStackProvider } from '../providers'
import { ContentFormatter, Logger, TokenEstimator } from '../utils'

/**
 * Registers the command to copy selected (or all) staged files.
 */
export function registerCopyFileCommand(
  extensionContext: vscode.ExtensionContext,
  contextStackProvider: ContextStackProvider,
  filesView: vscode.TreeView<StagedFile>,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.copyFile',
    async (item?: StagedFile, selectedItems?: StagedFile[]) => {
      const filesToCopy = resolveTargetFiles(item, selectedItems, filesView, contextStackProvider)

      if (filesToCopy.length === 0) {
        vscode.window.showInformationMessage('Context stack is empty.')
        return
      }

      try {
        const formattedContent = await ContentFormatter.format(filesToCopy)

        if (!formattedContent) {
          vscode.window.showWarningMessage('Selected content is empty or binary.')
          return
        }

        await vscode.env.clipboard.writeText(formattedContent)

        const stats = TokenEstimator.measure(formattedContent)
        const label = getFeedbackLabel(filesToCopy, contextStackProvider.getFiles().length)

        Logger.info(`Copied: ${label}`)
        vscode.window.showInformationMessage(`Copied ${label}! (${TokenEstimator.format(stats)})`)

        // Clarify fallback behavior when nothing was explicitly selected
        if (!item && (!selectedItems || selectedItems.length === 0) && filesView.selection.length === 0) {
          vscode.window.setStatusBarMessage('Nothing selected. Copied entire stack.', 3000)
        }
      } catch (error) {
        Logger.error('Copy failed', error)
        vscode.window.showErrorMessage('Failed to copy files.')
      }
    },
  )

  extensionContext.subscriptions.push(command)
}

/**
 * Resolves which files to copy based on invocation context.
 *
 * Selection resolution hierarchy:
 * 1. Multi-select from context menu (right-click with Ctrl/Cmd)
 * 2. Single-click item from context menu
 * 3. Current TreeView selection (keyboard navigation)
 * 4. All files (fallback when command invoked via status bar or palette)
 *
 * This hierarchy ensures intuitive behavior across all interaction patterns.
 */
function resolveTargetFiles(
  clickedItem: StagedFile | undefined,
  multiSelect: StagedFile[] | undefined,
  treeView: vscode.TreeView<StagedFile>,
  provider: ContextStackProvider,
): StagedFile[] {
  if (multiSelect && multiSelect.length > 0) return multiSelect

  if (clickedItem) return [clickedItem]

  if (treeView.selection.length > 0) return [...treeView.selection]

  return provider.getFiles()
}

function getFeedbackLabel(files: StagedFile[], totalStagedCount: number): string {
  if (files.length === totalStagedCount && files.length > 1) {
    return 'All Staged Files'
  }
  if (files.length === 1) {
    return files[0].label
  }
  return `${files.length} Files`
}
