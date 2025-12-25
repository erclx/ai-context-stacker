import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile } from '../models'
import { StackProvider } from '../providers'

/**
 * Centralizes logic for determining operation targets from UI interactions.
 * Handles priority of selection (ContextMenu > Selection > All) and folder flattening.
 */
export class SelectionResolver {
  /**
   * Resolves the final list of files to process.
   * Uses a cascading priority system to determine user intent.
   */
  public static resolve(
    clickedItem: StackTreeItem | undefined,
    selectedItems: StackTreeItem[] | undefined,
    treeView: vscode.TreeView<StackTreeItem>,
    stackProvider: StackProvider,
  ): StagedFile[] {
    const rawSelection = this.getRawSelection(clickedItem, selectedItems, treeView)

    // Fallback: Act on the entire stack if nothing is specifically selected
    if (rawSelection.length === 0) {
      return stackProvider.getFiles()
    }

    return this.flattenSelection(rawSelection)
  }

  /**
   * Flattens a mix of Files and Folders into a unique list of distinct StagedFiles.
   * Recursively unpacks folders.
   */
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

  /**
   * Generates a consistent human-readable label for feedback messages.
   */
  public static getFeedbackLabel(files: StagedFile[], totalStagedCount: number): string {
    if (files.length === totalStagedCount && totalStagedCount > 1) {
      return 'All Staged Files'
    }
    if (files.length === 1) {
      return files[0].label
    }
    return `${files.length} Files`
  }

  /**
   * Resolution Hierarchy:
   * 1. Context Menu Multi-select
   * 2. Context Menu Single-click
   * 3. Tree View Selection
   */
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
