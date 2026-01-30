import * as vscode from 'vscode'

import { IgnoreManager, StackProvider } from '../providers'
import { attachPickerToggle } from '../utils'
import { Command, CommandDependencies } from './types'

interface FileQuickPickItem extends vscode.QuickPickItem {
  uri: vscode.Uri
}

export function getAddFilePickerCommands(deps: CommandDependencies): Command[] {
  const { stackProvider, ignoreManager } = deps.services
  return [
    {
      id: 'aiContextStacker.addFilePicker',
      execute: async () => {
        try {
          await executePickerFlow(stackProvider, ignoreManager)
        } catch (error) {
          vscode.window.showErrorMessage(`Picker Error: ${error instanceof Error ? error.message : String(error)}`)
        }
      },
    },
  ]
}

async function executePickerFlow(stackProvider: StackProvider, ignoreManager: IgnoreManager): Promise<void> {
  const newFiles = await findUnstagedFiles(stackProvider, ignoreManager)

  if (newFiles.length === 0) {
    vscode.window.showInformationMessage('All files in workspace are already staged!')
    return
  }

  const selectedItems = await showFilePicker(newFiles)
  if (!selectedItems || selectedItems.length === 0) return

  await processSelection(selectedItems, stackProvider)
}

async function processSelection(items: readonly FileQuickPickItem[], provider: StackProvider): Promise<void> {
  const uris = items.map((i) => i.uri)

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

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  allFiles.sort((a, b) => collator.compare(a.fsPath, b.fsPath))

  return allFiles.filter((uri) => !stagedFileIds.has(uri.toString()))
}

function showFilePicker(files: vscode.Uri[]): Promise<readonly FileQuickPickItem[] | undefined> {
  return new Promise((resolve) => {
    const picker = vscode.window.createQuickPick<FileQuickPickItem>()
    const fileItems = createFileItems(files)

    configurePicker(picker, fileItems)
    bindPickerEvents(picker, resolve)

    picker.show()
  })
}

function createFileItems(files: vscode.Uri[]): FileQuickPickItem[] {
  return files.map((uri) => ({
    label: vscode.workspace.asRelativePath(uri),
    uri: uri,
    iconPath: new vscode.ThemeIcon('file'),
  }))
}

function configurePicker(picker: vscode.QuickPick<FileQuickPickItem>, fileItems: FileQuickPickItem[]): void {
  picker.canSelectMany = true
  picker.placeholder = 'Search and select files to add...'
  picker.title = 'Add Files to Context Stack'
  picker.matchOnDescription = true
  picker.matchOnDetail = true
  picker.items = fileItems
}

function bindPickerEvents(
  picker: vscode.QuickPick<FileQuickPickItem>,
  resolve: (value: readonly FileQuickPickItem[] | undefined) => void,
): void {
  attachPickerToggle(picker)

  picker.onDidAccept(() => {
    resolve(picker.selectedItems)
    picker.hide()
  })

  picker.onDidHide(() => {
    resolve(undefined)
    picker.dispose()
  })
}
