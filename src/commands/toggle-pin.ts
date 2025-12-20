import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { ContextTrackManager } from '../providers'

/**
 * Toggles the pinned state of one or more staged files.
 */
export function registerTogglePinCommand(
  contextStackProvider: vscode.ExtensionContext,
  contextTrackManager: ContextTrackManager,
  filesView: vscode.TreeView<StagedFile>,
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
      else if (filesView.selection.length > 0) {
        targets = [...filesView.selection]
      }

      if (targets.length === 0) return

      contextTrackManager.toggleFilesPin(targets)
    },
  )

  contextStackProvider.subscriptions.push(command)
}
