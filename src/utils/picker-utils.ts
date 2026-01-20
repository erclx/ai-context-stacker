import * as vscode from 'vscode'

export function attachPickerToggle<T extends vscode.QuickPickItem>(picker: vscode.QuickPick<T>): vscode.Disposable {
  const contextKey = 'aiStackerPickerVisible'
  const toggleCommandId = 'aiContextStacker.internalToggle'
  const selectAllCommandId = 'aiContextStacker.internalSelectAll'
  const nextCommandId = 'aiContextStacker.internalNext'
  const prevCommandId = 'aiContextStacker.internalPrev'

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

  const nextCommand = vscode.commands.registerCommand(nextCommandId, () => {
    moveActiveItem(picker, 1)
  })

  const prevCommand = vscode.commands.registerCommand(prevCommandId, () => {
    moveActiveItem(picker, -1)
  })

  const cleanup = () => {
    void vscode.commands.executeCommand('setContext', contextKey, false)
    toggleCommand.dispose()
    selectAllCommand.dispose()
    nextCommand.dispose()
    prevCommand.dispose()
    hideListener.dispose()
  }

  const hideListener = picker.onDidHide(cleanup)

  return vscode.Disposable.from(toggleCommand, selectAllCommand, nextCommand, prevCommand, hideListener)
}

function moveActiveItem<T extends vscode.QuickPickItem>(picker: vscode.QuickPick<T>, direction: number): void {
  const items = picker.items
  if (!items.length) return

  const activeItem = picker.activeItems[0]
  const currentIndex = activeItem ? items.indexOf(activeItem) : -1
  const count = items.length

  let newIndex = currentIndex

  for (let i = 0; i < count; i++) {
    newIndex = (((newIndex + direction) % count) + count) % count

    const item = items[newIndex]
    if (item.kind !== vscode.QuickPickItemKind.Separator) {
      picker.activeItems = [item]
      return
    }
  }
}
