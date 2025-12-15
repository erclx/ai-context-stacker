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
    (item?: StagedFile, multiSelect?: StagedFile[]) => {
      if (multiSelect && multiSelect.length > 0) {
        multiSelect.forEach((file) => provider.removeFile(file))
        return
      }

      if (item) {
        provider.removeFile(item)
        return
      }

      if (treeView.selection.length > 0) {
        treeView.selection.forEach((file) => provider.removeFile(file))
        return
      }

      vscode.window.showWarningMessage('Please select a file to remove.')
    },
  )

  context.subscriptions.push(command)
}
