import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile } from '../models'
import { StackProvider } from '../providers'

export class SelectionResolver {
  public static resolve(
    clickedItem: StackTreeItem | undefined,
    selectedItems: StackTreeItem[] | undefined,
    treeView: vscode.TreeView<StackTreeItem>,
    stackProvider: StackProvider,
  ): StagedFile[] {
    const rawSelection = this.getRawSelection(clickedItem, selectedItems, treeView)

    if (rawSelection.length === 0) {
      return stackProvider.getFiles()
    }

    return this.flattenSelection(rawSelection)
  }

  public static flattenSelection(items: StackTreeItem[]): StagedFile[] {
    const uniqueFiles = new Map<string, StagedFile>()

    for (const item of items) {
      if (isStagedFolder(item)) {
        item.containedFiles.forEach((f) => uniqueFiles.set(f.uri.toString(), f))
      } else {
        uniqueFiles.set(item.uri.toString(), item)
      }
    }

    return Array.from(uniqueFiles.values())
  }

  public static getFeedbackLabel(files: StagedFile[], totalStagedCount: number): string {
    if (files.length === totalStagedCount && totalStagedCount > 1) {
      return 'All Staged Files'
    }
    if (files.length === 1) {
      return files[0].label
    }
    return `${files.length} Files`
  }

  private static getRawSelection(
    clickedItem: StackTreeItem | undefined,
    selectedItems: StackTreeItem[] | undefined,
    treeView: vscode.TreeView<StackTreeItem>,
  ): StackTreeItem[] {
    if (selectedItems && selectedItems.length > 0) {
      return selectedItems
    }

    if (clickedItem) {
      return [clickedItem]
    }

    if (treeView.selection.length > 0) {
      return [...treeView.selection]
    }

    return []
  }
}
