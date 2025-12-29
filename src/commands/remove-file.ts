import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile } from '../models'
import { Command, CommandDependencies } from './types'

export function getRemoveFileCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.removeFile',
      execute: (item?: StackTreeItem, selectedItems?: StackTreeItem[]) => {
        let targets: StackTreeItem[] = []

        if (selectedItems && selectedItems.length > 0) {
          targets = selectedItems
        } else if (item) {
          targets = [item]
        } else {
          targets = [...deps.views.filesView.selection]
        }

        if (targets.length === 0) {
          if (!item) vscode.window.showWarningMessage('Please select files to remove.')
          return
        }

        const filesToRemove = resolveFilesToRemove(targets)
        deps.services.stackProvider.removeFiles(filesToRemove)

        if (filesToRemove.length > 0) {
          vscode.window.setStatusBarMessage(`Removed ${filesToRemove.length} files.`, 2000)
        }
      },
    },
  ]
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
