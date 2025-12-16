import * as vscode from 'vscode'

import { ContextStackProvider, IgnorePatternProvider } from '../providers'

interface FileQuickPickItem extends vscode.QuickPickItem {
  uri: vscode.Uri
}

export function registerAddFilePickerCommand(
  context: vscode.ExtensionContext,
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

  context.subscriptions.push(command)
}

/**
 * Helper: Finds all workspace files that are not currently in the stack,
 * respecting the ignore patterns.
 */
async function findUnstagedFiles(
  provider: ContextStackProvider,
  ignoreProvider: IgnorePatternProvider,
): Promise<vscode.Uri[]> {
  const stagedFiles = provider.getFiles()
  const stagedFileIds = new Set(stagedFiles.map((f) => f.uri.toString()))

  const excludePatterns = await ignoreProvider.getExcludePatterns()
  const allFiles = await vscode.workspace.findFiles('**/*', excludePatterns)

  return allFiles.filter((uri) => !stagedFileIds.has(uri.toString()))
}

/**
 * Helper: Configures and shows the QuickPick UI.
 */
async function showFilePicker(files: vscode.Uri[]): Promise<FileQuickPickItem[] | undefined> {
  const items: FileQuickPickItem[] = files.map((uri) => ({
    label: vscode.workspace.asRelativePath(uri),
    uri: uri,
  }))

  return vscode.window.showQuickPick(items, {
    canPickMany: true,
    placeHolder: 'Search and select files to add...',
    title: 'Add Files to Context Stack',
    matchOnDescription: true,
    matchOnDetail: true,
  })
}
