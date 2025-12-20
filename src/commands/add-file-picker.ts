import * as vscode from 'vscode'

import { ContextStackProvider, IgnorePatternProvider } from '../providers'

/**
 * Extends QuickPickItem to hold the underlying file URI.
 */
interface FileQuickPickItem extends vscode.QuickPickItem {
  uri: vscode.Uri
}

/**
 * Registers the command that allows the user to pick files from the workspace
 * to add to the stack, excluding already staged files and ignored files.
 *
 * @param extensionContext The extension context.
 * @param contextStackProvider The provider managing the staged files.
 * @param ignorePatternProvider The provider handling file exclusion patterns.
 */
export function registerAddFilePickerCommand(
  extensionContext: vscode.ExtensionContext,
  contextStackProvider: ContextStackProvider,
  ignorePatternProvider: IgnorePatternProvider,
): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addFilePicker', async () => {
    // 1. Data Retrieval Phase
    const newFiles = await findUnstagedFiles(contextStackProvider, ignorePatternProvider)

    if (newFiles.length === 0) {
      vscode.window.showInformationMessage('All files in workspace are already staged!')
      return
    }

    // 2. UI Interaction Phase
    const selectedItems = await showFilePicker(newFiles)

    // 3. State Update Phase
    if (selectedItems && selectedItems.length > 0) {
      const uris = selectedItems.map((item) => item.uri)
      contextStackProvider.addFiles(uris)
      vscode.window.showInformationMessage(`Added ${uris.length} file(s) to context stack`)
    }
  })

  extensionContext.subscriptions.push(command)
}

/**
 * Helper: Finds all workspace files that are not currently in the stack,
 * respecting the ignore patterns.
 *
 * @param contextStackProvider The current file stack provider.
 * @param ignorePatternProvider The provider for exclusion patterns.
 * @returns A promise resolving to an array of URIs that can be staged.
 */
async function findUnstagedFiles(
  contextStackProvider: ContextStackProvider,
  ignorePatternProvider: IgnorePatternProvider,
): Promise<vscode.Uri[]> {
  const stagedFiles = contextStackProvider.getFiles()
  // Use a Set for O(1) lookups to check if a file is already staged
  const stagedFileIds = new Set(stagedFiles.map((f) => f.uri.toString()))

  // Get combined exclusion patterns (.gitignore + defaults)
  const excludePatterns = await ignorePatternProvider.getExcludePatterns()
  // Find all files in the workspace, respecting exclusion patterns
  const allFiles = await vscode.workspace.findFiles('**/*', excludePatterns)

  // Filter the full list to only include files that are not already staged
  return allFiles.filter((uri) => !stagedFileIds.has(uri.toString()))
}

/**
 * Helper: Configures and shows the QuickPick UI.
 *
 * @param files The list of URIs available for selection.
 * @returns A promise resolving to the selected QuickPick items or undefined if cancelled.
 */
async function showFilePicker(files: vscode.Uri[]): Promise<FileQuickPickItem[] | undefined> {
  // Convert URIs to QuickPick items, using relative path for the primary label
  const items: FileQuickPickItem[] = files.map((uri) => ({
    label: vscode.workspace.asRelativePath(uri),
    uri: uri,
  }))

  return vscode.window.showQuickPick(items, {
    canPickMany: true,
    placeHolder: 'Search and select files to add...',
    title: 'Add Files to Context Stack',
    // Enable fuzzy matching against description/detail for better search
    matchOnDescription: true,
    matchOnDetail: true,
  })
}
