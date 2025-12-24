import * as vscode from 'vscode'

import { IgnoreManager, StackProvider } from '../providers'

interface FileQuickPickItem extends vscode.QuickPickItem {
  uri?: vscode.Uri
  id: 'file' | 'action'
}

export function registerAddFilePickerCommand(
  context: vscode.ExtensionContext,
  stackProvider: StackProvider,
  ignoreManager: IgnoreManager,
): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addFilePicker', async () => {
    const newFiles = await findUnstagedFiles(stackProvider, ignoreManager)

    if (newFiles.length === 0) {
      vscode.window.showInformationMessage('All files in workspace are already staged!')
      return
    }

    const selectedItems = await showFilePicker(newFiles)
    if (!selectedItems || selectedItems.length === 0) return

    // If "Add All" is selected, ignore specific choices and add everything
    if (selectedItems.some((i) => i.id === 'action')) {
      stackProvider.addFiles(newFiles)
      vscode.window.showInformationMessage(`Added all ${newFiles.length} file(s) to context stack`)
      return
    }

    // Otherwise, add only the specifically selected files
    const uris = selectedItems.filter((i) => i.id === 'file' && i.uri).map((i) => i.uri!)

    if (uris.length > 0) {
      stackProvider.addFiles(uris)
      vscode.window.showInformationMessage(`Added ${uris.length} file(s) to context stack`)
    }
  })

  context.subscriptions.push(command)
}

async function findUnstagedFiles(stackProvider: StackProvider, ignoreManager: IgnoreManager): Promise<vscode.Uri[]> {
  const stagedFiles = stackProvider.getFiles()
  const stagedFileIds = new Set(stagedFiles.map((f) => f.uri.toString()))

  const excludePatterns = await ignoreManager.getExcludePatterns()
  const allFiles = await vscode.workspace.findFiles('**/*', excludePatterns)

  return allFiles.filter((uri) => !stagedFileIds.has(uri.toString()))
}

async function showFilePicker(files: vscode.Uri[]): Promise<FileQuickPickItem[] | undefined> {
  const fileItems: FileQuickPickItem[] = files.map((uri) => ({
    label: vscode.workspace.asRelativePath(uri),
    uri: uri,
    id: 'file',
    iconPath: new vscode.ThemeIcon('file'),
  }))

  const addAllItem: FileQuickPickItem = {
    label: '$(check-all) Add All Unstaged Files',
    description: `(${files.length} files)`,
    id: 'action',
    alwaysShow: true,
  }

  return vscode.window.showQuickPick([addAllItem, ...fileItems], {
    canPickMany: true,
    placeHolder: 'Search and select files to add...',
    title: 'Add Files to Context Stack',
    matchOnDescription: true,
    matchOnDetail: true,
  })
}
