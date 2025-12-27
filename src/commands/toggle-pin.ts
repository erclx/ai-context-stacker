import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile } from '../models'
import { TrackManager } from '../providers'

export function registerTogglePinCommand(
  context: vscode.ExtensionContext,
  trackManager: TrackManager,
  filesView: vscode.TreeView<StackTreeItem>,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.togglePin',
    (item?: StackTreeItem, selectedItems?: StackTreeItem[]) => {
      let targets: StackTreeItem[] = []

      if (selectedItems && selectedItems.length > 0) {
        targets = selectedItems
      } else if (item) {
        targets = [item]
      } else if (filesView.selection.length > 0) {
        targets = [...filesView.selection]
      }

      if (targets.length === 0) return

      const filesToToggle = resolveFilesToToggle(targets)
      trackManager.toggleFilesPin(filesToToggle)
    },
  )

  context.subscriptions.push(command)
}

function resolveFilesToToggle(items: StackTreeItem[]): StagedFile[] {
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
