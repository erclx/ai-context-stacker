import * as vscode from 'vscode'

import { StackProvider } from '../providers'
import { Command, CommandDependencies } from './types'

export function getRemoveFilePickerCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.removeFilePicker',
      execute: () => handleRemovePicker(deps.services.stackProvider),
    },
  ]
}

async function handleRemovePicker(provider: StackProvider): Promise<void> {
  const currentFiles = provider.getFiles()

  if (currentFiles.length === 0) {
    void vscode.window.showInformationMessage('Stack is already empty.')
    return
  }

  const items = currentFiles.map((file) => ({
    label: vscode.workspace.asRelativePath(file.uri),
    description: file.isPinned ? '$(pin) Pinned' : undefined,
    picked: false,
    iconPath: new vscode.ThemeIcon('file'),
    file: file,
  }))

  const selectedItems = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    placeHolder: 'Select files to remove from the stack',
    title: 'Remove Files',
    matchOnDescription: true,
    matchOnDetail: true,
  })

  if (!selectedItems || selectedItems.length === 0) return

  const filesToRemove = selectedItems.map((i) => i.file)

  if (filesToRemove.length > 0) {
    provider.removeFiles(filesToRemove)
    void vscode.window.setStatusBarMessage(`Removed ${filesToRemove.length} files from stack.`, 2000)
  }
}
