import * as vscode from 'vscode'

import { StackProvider } from '../providers'

export function registerRemoveFilePickerCommand(context: vscode.ExtensionContext, provider: StackProvider): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.removeFilePicker', () => handleRemovePicker(provider)),
  )
}

async function handleRemovePicker(provider: StackProvider): Promise<void> {
  const currentFiles = provider.getFiles()

  if (currentFiles.length === 0) {
    void vscode.window.showInformationMessage('Stack is already empty.')
    return
  }

  const items = currentFiles.map((file) => ({
    label: file.label,
    description: file.isPinned ? '$(pin) Pinned' : '',
    picked: true,
    file: file,
  }))

  const selectedItems = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    placeHolder: 'Uncheck files to remove them from the stack',
    title: 'Remove Files',
  })

  if (!selectedItems) return

  const remainingUris = new Set(selectedItems.map((i) => i.file.uri.toString()))
  const filesToRemove = currentFiles.filter((f) => !remainingUris.has(f.uri.toString()))

  if (filesToRemove.length > 0) {
    provider.removeFiles(filesToRemove)
    void vscode.window.setStatusBarMessage(`Removed ${filesToRemove.length} files from stack.`, 2000)
  }
}
