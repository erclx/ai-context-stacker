import * as vscode from 'vscode'

import { type StagedFile } from '../models'
import { ContextStackProvider } from '../providers'

export function registerRemoveFileCommand(
  extensionContext: vscode.ExtensionContext,
  contextStackProvider: ContextStackProvider,
  filesView: vscode.TreeView<StagedFile>,
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
        filesToRemove = [...filesView.selection]
      }

      if (filesToRemove.length === 0) {
        if (!item) vscode.window.showWarningMessage('Please select files to remove.')
        return
      }

      contextStackProvider.removeFiles(filesToRemove)

      if (filesToRemove.length > 1) {
        vscode.window.setStatusBarMessage(`Removed ${filesToRemove.length} files.`, 2000)
      }
    },
  )

  extensionContext.subscriptions.push(command)
}
