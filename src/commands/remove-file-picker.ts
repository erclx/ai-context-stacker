import * as vscode from 'vscode'

import { StackProvider } from '../providers'
import { attachPickerToggle } from '../utils'
import { Command, CommandDependencies } from './types'

type StagedFile = ReturnType<StackProvider['getFiles']>[number]

interface RemoveFileItem extends vscode.QuickPickItem {
  file: StagedFile
}

export function getRemoveFilePickerCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.removeFilePicker',
      execute: () => handleRemovePicker(deps.services.stackProvider),
    },
  ]
}

async function handleRemovePicker(provider: StackProvider): Promise<void> {
  const currentFiles = [...provider.getFiles()]

  if (currentFiles.length === 0) {
    void vscode.window.showInformationMessage('Stack is already empty.')
    return
  }

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  currentFiles.sort((a, b) => collator.compare(a.uri.fsPath, b.uri.fsPath))

  const items: RemoveFileItem[] = currentFiles.map((file) => ({
    label: vscode.workspace.asRelativePath(file.uri),
    description: file.isPinned ? '$(pin) Pinned' : undefined,
    picked: false,
    iconPath: new vscode.ThemeIcon('file'),
    file: file,
  }))

  const selectedItems = await showRemoveFilePicker(items)

  if (!selectedItems || selectedItems.length === 0) return

  const filesToRemove = selectedItems.map((i) => i.file)

  if (filesToRemove.length > 0) {
    provider.removeFiles(filesToRemove)
    void vscode.window.setStatusBarMessage(`Removed ${filesToRemove.length} files from stack.`, 2000)
  }
}

function showRemoveFilePicker(items: RemoveFileItem[]): Promise<readonly RemoveFileItem[] | undefined> {
  return new Promise((resolve) => {
    const picker = vscode.window.createQuickPick<RemoveFileItem>()

    picker.items = items
    picker.canSelectMany = true
    picker.placeholder = 'Select files to remove from the stack'
    picker.title = 'Remove Files'
    picker.matchOnDescription = true
    picker.matchOnDetail = true

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
