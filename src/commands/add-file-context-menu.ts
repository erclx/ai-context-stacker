import * as vscode from 'vscode'

import { ContextStackProvider, IgnorePatternProvider } from '../providers'
import { categorizeTargets, handleFolderScanning } from '../utils/file-scanner'

/**
 * Registers command to add files from Context Menu or Command Palette.
 * @param context Extension context for subscription management
 * @param provider The tree data provider managing the stack state
 * @param ignoreProvider Provider for filtering files against ignore patterns
 */
export function registerAddFileContextMenuCommand(
  context: vscode.ExtensionContext,
  provider: ContextStackProvider,
  ignoreProvider: IgnorePatternProvider,
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
        provider.addFiles(files)
      }

      if (folders.length > 0) {
        await handleFolderScanning(folders, provider, ignoreProvider)
      } else if (files.length > 0) {
        vscode.window.setStatusBarMessage(`Added ${files.length} files.`, 2000)
      }
    },
  )

  context.subscriptions.push(command)
}

/**
 * Normalizes input from different trigger sources (Menu vs Palette vs Shortcut).
 * @param clickedUri The primary URI clicked in the explorer
 * @param selectedUris The full list of URIs selected in the explorer
 */
function resolveTargets(clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]): vscode.Uri[] {
  // VS Code context menu provides both the clicked item and the full selection
  if (selectedUris && selectedUris.length > 0) return selectedUris

  if (clickedUri) return [clickedUri]

  // Fallback ensures functionality when command is triggered via Command Palette
  if (vscode.window.activeTextEditor) return [vscode.window.activeTextEditor.document.uri]

  return []
}
