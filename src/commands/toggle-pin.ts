import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { ContextTrackManager } from '../providers'

/**
 * Toggles the pinned state of one or more staged files.
 */
export function registerTogglePinCommand(
  context: vscode.ExtensionContext,
  trackManager: ContextTrackManager,
  treeView: vscode.TreeView<StagedFile>,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.togglePin',
    (item?: StagedFile, selectedItems?: StagedFile[]) => {
      let targets: StagedFile[] = []

      // 1. Context Menu: Multi-Select
      if (selectedItems && selectedItems.length > 0) {
        targets = selectedItems
      }
      // 2. Context Menu: Single Item (Right-click or Inline Action)
      else if (item) {
        targets = [item]
      }
      // 3. Keybinding / Command Palette (Use active selection)
      else if (treeView.selection.length > 0) {
        targets = [...treeView.selection]
      }

      if (targets.length === 0) return

      trackManager.toggleFilesPin(targets)
    },
  )

  context.subscriptions.push(command)
}
