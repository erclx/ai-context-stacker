import { isStagedFolder, StackTreeItem, StagedFile } from '../models'
import { Command, CommandDependencies } from './types'

export function getTogglePinCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.togglePin',
      execute: (item?: StackTreeItem, selectedItems?: StackTreeItem[]) => {
        let targets: StackTreeItem[] = []
        const filesView = deps.views.filesView

        if (selectedItems && selectedItems.length > 0) {
          targets = selectedItems
        } else if (item) {
          targets = [item]
        } else if (filesView.selection.length > 0) {
          targets = [...filesView.selection]
        }

        if (targets.length === 0) return

        const filesToToggle = resolveFilesToToggle(targets)
        deps.services.trackManager.toggleFilesPin(filesToToggle)
      },
    },
  ]
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
