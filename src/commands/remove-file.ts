import * as vscode from 'vscode'

import { type StagedFile } from '@/models'
import { ContextStackProvider } from '@/providers'

export function registerRemoveFileCommand(
  context: vscode.ExtensionContext,
  provider: ContextStackProvider,
  treeView: vscode.TreeView<StagedFile>,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.removeFile',
    (item?: StagedFile, selectedItems?: StagedFile[]) => {
      let filesToRemove: StagedFile[] = []

      if (selectedItems && selectedItems.length > 0) {
        filesToRemove = selectedItems
      } else if (item) {
        filesToRemove = [item]
      } else {
        filesToRemove = [...treeView.selection]
      }

      if (filesToRemove.length === 0) {
        vscode.window.showWarningMessage('Please select files to remove.')
        return
      }

      provider.removeFiles(filesToRemove)

      if (filesToRemove.length > 1) {
        vscode.window.setStatusBarMessage(`Removed ${filesToRemove.length} files.`, 2000)
      }
    },
  )

  context.subscriptions.push(command)
}
