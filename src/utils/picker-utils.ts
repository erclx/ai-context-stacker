import * as vscode from 'vscode'

export function attachPickerToggle<T extends vscode.QuickPickItem>(picker: vscode.QuickPick<T>): vscode.Disposable {
  const contextKey = 'aiStackerPickerVisible'
  const commandId = 'aiContextStacker.internalToggle'

  void vscode.commands.executeCommand('setContext', contextKey, true)

  const toggleCommand = vscode.commands.registerCommand(commandId, () => {
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

  const cleanup = () => {
    void vscode.commands.executeCommand('setContext', contextKey, false)
    toggleCommand.dispose()
    hideListener.dispose()
  }

  const hideListener = picker.onDidHide(cleanup)

  return vscode.Disposable.from(toggleCommand, hideListener)
}
