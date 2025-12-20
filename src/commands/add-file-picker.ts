import * as vscode from 'vscode'

import { ContextStackProvider, IgnorePatternProvider } from '../providers'

interface FileQuickPickItem extends vscode.QuickPickItem {
  uri: vscode.Uri
}

export function registerAddFilePickerCommand(
  extensionContext: vscode.ExtensionContext,
  contextStackProvider: ContextStackProvider,
  ignorePatternProvider: IgnorePatternProvider,
): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addFilePicker', async () => {
    const newFiles = await findUnstagedFiles(contextStackProvider, ignorePatternProvider)

    if (newFiles.length === 0) {
      vscode.window.showInformationMessage('All files in workspace are already staged!')
      return
    }

    const selectedItems = await showFilePicker(newFiles)

    if (selectedItems && selectedItems.length > 0) {
      const uris = selectedItems.map((item) => item.uri)
      contextStackProvider.addFiles(uris)
      vscode.window.showInformationMessage(`Added ${uris.length} file(s) to context stack`)
    }
  })

  extensionContext.subscriptions.push(command)
}

async function findUnstagedFiles(
  contextStackProvider: ContextStackProvider,
  ignorePatternProvider: IgnorePatternProvider,
): Promise<vscode.Uri[]> {
  const stagedFiles = contextStackProvider.getFiles()
  const stagedFileIds = new Set(stagedFiles.map((f) => f.uri.toString()))

  // Respect .gitignore to avoid cluttering picker with build artifacts
  const excludePatterns = await ignorePatternProvider.getExcludePatterns()
  const allFiles = await vscode.workspace.findFiles('**/*', excludePatterns)

  return allFiles.filter((uri) => !stagedFileIds.has(uri.toString()))
}

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
