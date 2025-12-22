import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile } from '../models'
import { StackProvider } from '../providers'

export function registerRemoveFileCommand(
  context: vscode.ExtensionContext,
  stackProvider: StackProvider,
  filesView: vscode.TreeView<StackTreeItem>,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.removeFile',
    (item?: StackTreeItem, selectedItems?: StackTreeItem[]) => {
      let targets: StackTreeItem[] = []

      // Normalize selection source (right-click vs keyboard selection)
      if (selectedItems && selectedItems.length > 0) {
        targets = selectedItems
      } else if (item) {
        targets = [item]
      } else {
        targets = [...filesView.selection]
      }

      if (targets.length === 0) {
        if (!item) vscode.window.showWarningMessage('Please select files to remove.')
        return
      }

      const filesToRemove = resolveFilesToRemove(targets)
      stackProvider.removeFiles(filesToRemove)

      if (filesToRemove.length > 0) {
        vscode.window.setStatusBarMessage(`Removed ${filesToRemove.length} files.`, 2000)
      }
    },
  )

  context.subscriptions.push(command)
}

function resolveFilesToRemove(items: StackTreeItem[]): StagedFile[] {
  const fileMap = new Map<string, StagedFile>()

  for (const item of items) {
    if (isStagedFolder(item)) {
      item.containedFiles.forEach((f) => fileMap.set(f.uri.toString(), f))
    } else {
      fileMap.set(item.uri.toString(), item)
    }
  }

  return Array.from(fileMap.values())
}
