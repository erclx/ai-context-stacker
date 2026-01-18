import * as path from 'path'
import * as vscode from 'vscode'

import { StackProvider } from '../providers'
import { attachPickerToggle, isChildOf } from '../utils'
import { Command, CommandDependencies } from './types'

type StagedFile = ReturnType<StackProvider['getFiles']>[number]

interface FolderItem extends vscode.QuickPickItem {
  uri: vscode.Uri
  fileCount: number
}

export function getRemoveFolderPickerCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.removeFolderPicker',
      execute: () => handleRemoveFolderPicker(deps.services.stackProvider),
    },
  ]
}

async function handleRemoveFolderPicker(provider: StackProvider): Promise<void> {
  const currentFiles = provider.getFiles()

  if (currentFiles.length === 0) {
    void vscode.window.showInformationMessage('Stack is already empty.')
    return
  }

  const folderMap = analyzeFolders(currentFiles)
  const items = createPickerItems(folderMap)

  if (items.length === 0) {
    void vscode.window.showInformationMessage('No folder structures found in stack (only root files).')
    return
  }

  const selected = await showRemoveFolderPicker(items)

  if (!selected || selected.length === 0) return

  await performBatchRemoval(selected, currentFiles, provider)
}

function showRemoveFolderPicker(items: FolderItem[]): Promise<readonly FolderItem[] | undefined> {
  return new Promise((resolve) => {
    const picker = vscode.window.createQuickPick<FolderItem>()

    picker.items = items
    picker.canSelectMany = true
    picker.placeholder = 'Select folders to remove from the stack'
    picker.title = 'Remove Folder from Stack'
    picker.matchOnDescription = true

    attachPickerToggle(picker)

    picker.onDidAccept(() => {
      resolve(picker.selectedItems)
      picker.hide()
    })

    picker.onDidHide(() => {
      resolve(undefined)
      picker.dispose()
    })

    picker.show()
  })
}

function analyzeFolders(files: StagedFile[]): Map<string, { uri: vscode.Uri; count: number }> {
  const map = new Map<string, { uri: vscode.Uri; count: number }>()
  const fileUris = files.map((f) => f.uri)

  for (const file of files) {
    const parents = getParentChain(file.uri)
    for (const parent of parents) {
      const key = parent.fsPath
      if (!map.has(key)) {
        const count = fileUris.filter((u) => isChildOf(parent, u)).length
        if (count > 0) {
          map.set(key, { uri: parent, count })
        }
      }
    }
  }
  return map
}

function getParentChain(uri: vscode.Uri): vscode.Uri[] {
  const parents: vscode.Uri[] = []
  const wsFolder = vscode.workspace.getWorkspaceFolder(uri)
  let current = vscode.Uri.file(path.dirname(uri.fsPath))

  while (true) {
    if (wsFolder && !isChildOf(wsFolder.uri, current)) break

    if (wsFolder && current.fsPath === wsFolder.uri.fsPath) break

    const parentPath = path.dirname(current.fsPath)
    if (parentPath === current.fsPath) break

    parents.push(current)
    current = vscode.Uri.file(parentPath)
  }

  return parents
}

function createPickerItems(map: Map<string, { uri: vscode.Uri; count: number }>): FolderItem[] {
  return Array.from(map.values())
    .sort((a, b) => a.uri.fsPath.localeCompare(b.uri.fsPath))
    .map((item) => createPickerItem(item.uri, item.count))
}

function createPickerItem(uri: vscode.Uri, count: number): FolderItem {
  return {
    label: `$(folder) ${vscode.workspace.asRelativePath(uri)}`,
    description: `$(file) ${count} files`,
    uri,
    fileCount: count,
    picked: false,
  }
}

async function performBatchRemoval(
  folders: readonly FolderItem[],
  currentFiles: StagedFile[],
  provider: StackProvider,
): Promise<void> {
  const toRemove = new Set<string>()
  const folderUris = folders.map((f) => f.uri)

  for (const file of currentFiles) {
    if (folderUris.some((folder) => isChildOf(folder, file.uri))) {
      toRemove.add(file.uri.toString())
    }
  }

  const removeList = currentFiles.filter((f) => toRemove.has(f.uri.toString()))

  if (removeList.length > 0) {
    provider.removeFiles(removeList)
    void vscode.window.setStatusBarMessage(`Removed ${removeList.length} files from ${folders.length} folder(s).`, 2000)
  }
}
