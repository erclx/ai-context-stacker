import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { ContextTrackManager } from '../providers'

export function registerTogglePinCommand(
  contextStackProvider: vscode.ExtensionContext,
  contextTrackManager: ContextTrackManager,
  filesView: vscode.TreeView<StagedFile>,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.togglePin',
    (item?: StagedFile, selectedItems?: StagedFile[]) => {
      let targets: StagedFile[] = []

      if (selectedItems && selectedItems.length > 0) {
        targets = selectedItems
      } else if (item) {
        targets = [item]
      } else if (filesView.selection.length > 0) {
        targets = [...filesView.selection]
      }

      if (targets.length === 0) return

      contextTrackManager.toggleFilesPin(targets)
    },
  )

  contextStackProvider.subscriptions.push(command)
}
