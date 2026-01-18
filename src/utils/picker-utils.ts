import * as vscode from 'vscode'

export function attachPickerToggle<T extends vscode.QuickPickItem>(picker: vscode.QuickPick<T>): vscode.Disposable {
  const contextKey = 'aiStackerPickerVisible'
  const toggleCommandId = 'aiContextStacker.internalToggle'
  const selectAllCommandId = 'aiContextStacker.internalSelectAll'

  void vscode.commands.executeCommand('setContext', contextKey, true)

  const toggleCommand = vscode.commands.registerCommand(toggleCommandId, () => {
    const activeItems = picker.activeItems
    if (activeItems.length === 0) return

    const selectedSet = new Set(picker.selectedItems)
    const activeSet = new Set(activeItems)

    for (const item of activeSet) {
      if (selectedSet.has(item)) {
        selectedSet.delete(item)
      } else {
        selectedSet.add(item)
      }
    }

    picker.selectedItems = Array.from(selectedSet)
  })

  const selectAllCommand = vscode.commands.registerCommand(selectAllCommandId, () => {
    const allVisible = picker.items.filter((item) => item.kind !== vscode.QuickPickItemKind.Separator)

    if (picker.selectedItems.length === allVisible.length) {
      picker.selectedItems = []
    } else {
      picker.selectedItems = allVisible
    }
  })

  const cleanup = () => {
    void vscode.commands.executeCommand('setContext', contextKey, false)
    toggleCommand.dispose()
    selectAllCommand.dispose()
    hideListener.dispose()
  }

  const hideListener = picker.onDidHide(cleanup)

  return vscode.Disposable.from(toggleCommand, selectAllCommand, hideListener)
}
