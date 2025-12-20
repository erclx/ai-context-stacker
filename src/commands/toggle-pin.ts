import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile } from '../models'
import { ContextTrackManager } from '../providers'

export function registerTogglePinCommand(
  extensionContext: vscode.ExtensionContext,
  contextTrackManager: ContextTrackManager,
  filesView: vscode.TreeView<StackTreeItem>,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.togglePin',
    (item?: StackTreeItem, selectedItems?: StackTreeItem[]) => {
      let targets: StackTreeItem[] = []

      // Handle context menu selection vs keybinding selection
      if (selectedItems && selectedItems.length > 0) {
        targets = selectedItems
      } else if (item) {
        targets = [item]
      } else if (filesView.selection.length > 0) {
        targets = [...filesView.selection]
      }

      if (targets.length === 0) return

      const filesToToggle = resolveFilesToToggle(targets)
      contextTrackManager.toggleFilesPin(filesToToggle)
    },
  )

  extensionContext.subscriptions.push(command)
}

function resolveFilesToToggle(items: StackTreeItem[]): StagedFile[] {
  const fileMap = new Map<string, StagedFile>()

  for (const item of items) {
    if (isStagedFolder(item)) {
      // Flatten folder contents to toggle all children
      item.containedFiles.forEach((f) => fileMap.set(f.uri.toString(), f))
    } else {
      fileMap.set(item.uri.toString(), item)
    }
  }

  return Array.from(fileMap.values())
}
