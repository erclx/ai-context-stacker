import * as vscode from 'vscode'

import { IgnoreManager, StackProvider } from '../providers'
import { categorizeTargets, handleFolderScanning } from '../utils/file-scanner'

/**
 * Registers command to add files from Context Menu or Command Palette.
 * @param context Extension context for subscription management
 * @param stackProvider The tree data provider managing the stack state
 * @param ignoreManager Provider for filtering files against ignore patterns
 */
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

/**
 * Normalizes URI input from different trigger sources.
 *
 * VS Code command invocation patterns:
 * 1. Context menu multi-select: Both clickedUri and selectedUris provided
 * 2. Context menu single-click: Only clickedUri provided
 * 3. Command Palette: Neither provided, falls back to active editor
 * 4. Keyboard shortcut: Same as Command Palette
 *
 * @param clickedUri The primary URI clicked in the explorer
 * @param selectedUris The full list of URIs selected in the explorer
 */
function resolveTargets(clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]): vscode.Uri[] {
  if (selectedUris && selectedUris.length > 0) return selectedUris

  if (clickedUri) return [clickedUri]

  // Fallback for Command Palette or keyboard shortcuts
  if (vscode.window.activeTextEditor) return [vscode.window.activeTextEditor.document.uri]

  return []
}
