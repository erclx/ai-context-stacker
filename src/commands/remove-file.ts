import * as vscode from 'vscode'

import { type StagedFile } from '../models'
import { ContextStackProvider } from '../providers'

/**
 * Registers the command to remove one or more selected files from the context stack.
 *
 * @param context The extension context.
 * @param provider The ContextStackProvider instance.
 * @param treeView The TreeView instance to check for current selections.
 */
export function registerRemoveFileCommand(
  context: vscode.ExtensionContext,
  provider: ContextStackProvider,
  treeView: vscode.TreeView<StagedFile>,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.removeFile',
    // The command receives arguments differently based on the UI trigger
    (item?: StagedFile, selectedItems?: StagedFile[]) => {
      let filesToRemove: StagedFile[] = []

      // 1. Context Menu: Multi-Select
      if (selectedItems && selectedItems.length > 0) {
        filesToRemove = selectedItems
      }
      // 2. Context Menu: Single Item
      else if (item) {
        filesToRemove = [item]
      }
      // 3. Fallback: TreeView Selection
      else {
        filesToRemove = [...treeView.selection]
      }

      if (filesToRemove.length === 0) {
        // Only warn if triggered via keybinding/palette with no selection
        if (!item) vscode.window.showWarningMessage('Please select files to remove.')
        return
      }

      provider.removeFiles(filesToRemove)

      // Feedback for batch operations
      if (filesToRemove.length > 1) {
        vscode.window.setStatusBarMessage(`Removed ${filesToRemove.length} files.`, 2000)
      }
    },
  )

  context.subscriptions.push(command)
}
