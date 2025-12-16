import * as vscode from 'vscode'

import { type StagedFile } from '../models'
import { ContextStackProvider } from '../providers'
import { ContentFormatter, Logger, TokenEstimator } from '../utils'

/**
 * Registers the command to copy selected (or all) staged files to the clipboard.
 * This command handles various ways of being triggered: context menu on a single item,
 * context menu on multiple items, or a toolbar button when items are selected.
 *
 * @param context The extension context.
 * @param provider The ContextStackProvider instance.
 * @param treeView The TreeView instance to check for current selections.
 */
export function registerCopyFileCommand(
  context: vscode.ExtensionContext,
  provider: ContextStackProvider,
  treeView: vscode.TreeView<StagedFile>,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.copyFile',
    async (item?: StagedFile, selectedItems?: StagedFile[]) => {
      // 1. Resolve Selection
      // The VS Code API for commands triggered from a TreeView context menu
      // can pass the clicked item (item) and/or a list of selected items (selectedItems).
      // We must handle all permutations, including no selection (fallback to all).
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
 *
 * @returns The array of StagedFile objects to be copied.
 */
function resolveTargetFiles(
  clickedItem: StagedFile | undefined,
  multiSelect: StagedFile[] | undefined,
  treeView: vscode.TreeView<StagedFile>,
  provider: ContextStackProvider,
): StagedFile[] {
  // 1. Check for explicit multi-select from context menu (Highest precedence)
  if (multiSelect && multiSelect.length > 0) {
    return multiSelect
  }

  // 2. Check for single item click (Next precedence)
  if (clickedItem) {
    return [clickedItem]
  }

  // 3. Check for selection made via UI (e.g., toolbar button triggered)
  if (treeView.selection.length > 0) {
    // VS Code's TreeView selection is always up-to-date
    return [...treeView.selection]
  }

  // Fallback: Copy all files if the stack is not empty
  return provider.getFiles()
}

/**
 * Generates a human-readable label for the copied content.
 *
 * @param files The files that were copied.
 * @param totalStagedCount The total number of files in the stack.
 * @returns A user-friendly string for notifications.
 */
function getFeedbackLabel(files: StagedFile[], totalStagedCount: number): string {
  // Use "All Staged Files" only if copying everything AND there's more than one file
  if (files.length === totalStagedCount && files.length > 1) {
    return 'All Staged Files'
  }

  // If a single file was copied, use its label (filename)
  if (files.length === 1) {
    return files[0].label
  }

  // Otherwise, report the count
  return `${files.length} Files`
}
