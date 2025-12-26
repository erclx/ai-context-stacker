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
    try {
      await executePickerFlow(stackProvider, ignoreManager)
    } catch (error) {
      vscode.window.showErrorMessage(`Picker Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  context.subscriptions.push(command)
}

async function executePickerFlow(stackProvider: StackProvider, ignoreManager: IgnoreManager): Promise<void> {
  const newFiles = await findUnstagedFiles(stackProvider, ignoreManager)

  if (newFiles.length === 0) {
    vscode.window.showInformationMessage('All files in workspace are already staged!')
    return
  }

  const selectedItems = await showFilePicker(newFiles)
  if (!selectedItems || selectedItems.length === 0) return

  await processSelection(selectedItems, newFiles, stackProvider)
}

async function processSelection(
  items: readonly FileQuickPickItem[],
  allAvailableFiles: vscode.Uri[],
  provider: StackProvider,
): Promise<void> {
  if (items.some((i) => i.id === 'action')) {
    provider.addFiles(allAvailableFiles)
    vscode.window.showInformationMessage(`Added all ${allAvailableFiles.length} file(s) to context stack`)
    return
  }

  const uris = items.filter((i) => i.id === 'file' && i.uri).map((i) => i.uri as vscode.Uri)

  if (uris.length > 0) {
    provider.addFiles(uris)
    vscode.window.showInformationMessage(`Added ${uris.length} file(s) to context stack`)
  }
}

async function findUnstagedFiles(stackProvider: StackProvider, ignoreManager: IgnoreManager): Promise<vscode.Uri[]> {
  const stagedFiles = stackProvider.getFiles()
  const stagedFileIds = new Set(stagedFiles.map((f) => f.uri.toString()))

  const excludePatterns = await ignoreManager.getExcludePatterns()
  const allFiles = await vscode.workspace.findFiles('**/*', excludePatterns)

  return allFiles.filter((uri) => !stagedFileIds.has(uri.toString()))
}

function showFilePicker(files: vscode.Uri[]): Promise<readonly FileQuickPickItem[] | undefined> {
  return new Promise((resolve) => {
    const picker = vscode.window.createQuickPick<FileQuickPickItem>()
    const fileItems = createFileItems(files)
    const actionItem = createAddAllItem(files.length)

    configurePicker(picker, fileItems, actionItem)
    bindPickerEvents(picker, fileItems, actionItem, resolve)

    picker.show()
  })
}

function createFileItems(files: vscode.Uri[]): FileQuickPickItem[] {
  return files.map((uri) => ({
    label: vscode.workspace.asRelativePath(uri),
    uri: uri,
    id: 'file',
    iconPath: new vscode.ThemeIcon('file'),
  }))
}

function createAddAllItem(count: number): FileQuickPickItem {
  return {
    label: '$(check-all) Add All Unstaged Files',
    description: `(${count} files)`,
    id: 'action',
  }
}

function configurePicker(
  picker: vscode.QuickPick<FileQuickPickItem>,
  fileItems: FileQuickPickItem[],
  actionItem: FileQuickPickItem,
): void {
  picker.canSelectMany = true
  picker.placeholder = 'Search and select files to add...'
  picker.title = 'Add Files to Context Stack'
  picker.matchOnDescription = true
  picker.matchOnDetail = true
  picker.items = [actionItem, ...fileItems]
}

function bindPickerEvents(
  picker: vscode.QuickPick<FileQuickPickItem>,
  fileItems: FileQuickPickItem[],
  actionItem: FileQuickPickItem,
  resolve: (value: readonly FileQuickPickItem[] | undefined) => void,
): void {
  picker.onDidChangeValue((value) => {
    const previousSelection = picker.selectedItems

    const isSearchEmpty = value.trim() === ''
    const newItems = isSearchEmpty ? [actionItem, ...fileItems] : fileItems

    if (picker.items.length !== newItems.length) {
      picker.items = newItems

      picker.selectedItems = previousSelection
    }
  })

  picker.onDidAccept(() => {
    resolve(picker.selectedItems)
    picker.hide()
  })

  picker.onDidHide(() => {
    resolve(undefined)
    picker.dispose()
  })
}
