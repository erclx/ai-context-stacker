import * as path from 'path'
import * as vscode from 'vscode'

import { IgnoreManager, StackProvider } from '../providers'
import {
  attachPickerToggle,
  discoverWorkspaceFolders,
  handleFolderScanning,
  Logger,
  pruneNestedFolders,
} from '../utils'
import { Command, CommandDependencies } from './types'

interface FolderQuickPickItem extends vscode.QuickPickItem {
  uri: vscode.Uri
}

export function getAddFolderPickerCommands(deps: CommandDependencies): Command[] {
  const { stackProvider, ignoreManager } = deps.services
  return [
    {
      id: 'aiContextStacker.addFolderPicker',
      execute: async () => {
        await executeAddFolderPicker(stackProvider, ignoreManager)
      },
    },
  ]
}

async function executeAddFolderPicker(provider: StackProvider, ignore: IgnoreManager): Promise<void> {
  try {
    const folders = await discoverWorkspaceFolders(ignore)

    if (folders.length === 0) {
      void vscode.window.showInformationMessage('No relevant folders found.')
      return
    }

    const selected = await showFolderPicker(folders)
    if (!selected || selected.length === 0) return

    await processSelection(selected, provider, ignore)
  } catch (error) {
    Logger.error('Folder picker failed', error as Error)
    void vscode.window.showErrorMessage('Failed to add folders.')
  }
}

async function processSelection(
  items: FolderQuickPickItem[],
  provider: StackProvider,
  ignore: IgnoreManager,
): Promise<void> {
  const distinctRoots = pruneNestedFolders(items.map((i) => i.uri))

  await handleFolderScanning(distinctRoots, provider, ignore)
}

function showFolderPicker(folders: vscode.Uri[]): Promise<FolderQuickPickItem[] | undefined> {
  return new Promise((resolve) => {
    const picker = vscode.window.createQuickPick<FolderQuickPickItem>()
    const items = folders.map(createPickerItem)

    configurePicker(picker, items)
    bindPickerEvents(picker, resolve)

    picker.show()
  })
}

function configurePicker(picker: vscode.QuickPick<FolderQuickPickItem>, items: FolderQuickPickItem[]): void {
  picker.items = items
  picker.canSelectMany = true
  picker.placeholder = 'Search and select folders to add...'
  picker.title = 'Add Folders to Context Stack'
  picker.matchOnDescription = false
}

function bindPickerEvents(
  picker: vscode.QuickPick<FolderQuickPickItem>,
  resolve: (value: FolderQuickPickItem[] | undefined) => void,
): void {
  attachPickerToggle(picker)

  picker.onDidAccept(() => {
    resolve(Array.from(picker.selectedItems))
    picker.hide()
  })

  picker.onDidHide(() => {
    resolve(undefined)
    picker.dispose()
  })
}

function createPickerItem(uri: vscode.Uri): FolderQuickPickItem {
  const wsFolder = vscode.workspace.getWorkspaceFolder(uri)
  const isRoot = wsFolder ? uri.fsPath === wsFolder.uri.fsPath : false

  if (isRoot) {
    return {
      label: `$(root-folder) ${wsFolder?.name ?? path.basename(uri.fsPath)}`,
      description: 'Project Root',
      uri,
    }
  }

  return {
    label: `$(folder) ${vscode.workspace.asRelativePath(uri)}`,
    uri,
  }
}
