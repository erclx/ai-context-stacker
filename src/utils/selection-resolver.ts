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
   *
   * Resolution Hierarchy:
   * 1. Context Menu Multi-select (User right-clicked with multiple items selected)
   * 2. Context Menu Single-click (User right-clicked a single item)
   * 3. Tree View Selection (User navigated via keyboard or previous click)
   * 4. Fallback: All Files (Implicit 'Copy All' behavior)
   */
  public static resolve(
    clickedItem: StackTreeItem | undefined,
    selectedItems: StackTreeItem[] | undefined,
    treeView: vscode.TreeView<StackTreeItem>,
    stackProvider: StackProvider,
  ): StagedFile[] {
    let rawSelection: StackTreeItem[] = []

    if (selectedItems && selectedItems.length > 0) {
      rawSelection = selectedItems
    } else if (clickedItem) {
      rawSelection = [clickedItem]
    } else if (treeView.selection.length > 0) {
      rawSelection = [...treeView.selection]
    } else {
      // Fallback: Act on the entire stack if nothing is specifically selected
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

    const collect = (item: StackTreeItem) => {
      if (isStagedFolder(item)) {
        item.containedFiles.forEach((f) => uniqueFiles.set(f.uri.toString(), f))
      } else {
        uniqueFiles.set(item.uri.toString(), item)
      }
    }

    items.forEach(collect)
    return Array.from(uniqueFiles.values())
  }

  /**
   * Generates a consistent human-readable label for feedback messages.
   * e.g. "All Staged Files", "auth.ts", or "5 Files"
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
}
