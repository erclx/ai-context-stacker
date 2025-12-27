import * as vscode from 'vscode'

import { IgnoreManager, StackProvider } from '../providers'
import { categorizeTargets, handleFolderScanning } from '../utils/file-scanner'

export function registerAddFileContextMenuCommand(
  context: vscode.ExtensionContext,
  stackProvider: StackProvider,
  ignoreManager: IgnoreManager,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.addFileToStack',
    async (clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
      const targets = resolveTargets(clickedUri, selectedUris)
      if (targets.length === 0) {
        vscode.window.showWarningMessage('No selection found.')
        return
      }

      const { files, folders } = await categorizeTargets(targets)

      if (files.length > 0) {
        stackProvider.addFiles(files)
      }

      if (folders.length > 0) {
        await handleFolderScanning(folders, stackProvider, ignoreManager)
      } else if (files.length > 0) {
        vscode.window.setStatusBarMessage(`Added ${files.length} files.`, 2000)
      }
    },
  )

  context.subscriptions.push(command)
}

function resolveTargets(clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]): vscode.Uri[] {
  if (selectedUris && selectedUris.length > 0) return selectedUris

  if (clickedUri) return [clickedUri]

  if (vscode.window.activeTextEditor) return [vscode.window.activeTextEditor.document.uri]

  return []
}
