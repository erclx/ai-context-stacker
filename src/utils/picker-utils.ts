import * as vscode from 'vscode'

let activePicker: vscode.QuickPick<any> | undefined
let globalPickerCommands: vscode.Disposable | undefined

const CONTEXT_KEY = 'aiStackerPickerVisible'
const CMD_TOGGLE = 'aiContextStacker.internalToggle'
const CMD_SELECT_ALL = 'aiContextStacker.internalSelectAll'
const CMD_NEXT = 'aiContextStacker.internalNext'
const CMD_PREV = 'aiContextStacker.internalPrev'

export function attachPickerToggle<T extends vscode.QuickPickItem>(picker: vscode.QuickPick<T>): vscode.Disposable {
  activePicker = picker
  void vscode.commands.executeCommand('setContext', CONTEXT_KEY, true)

  if (!globalPickerCommands) {
    globalPickerCommands = vscode.Disposable.from(
      vscode.commands.registerCommand(CMD_TOGGLE, () => {
        if (activePicker) handleToggle(activePicker)
      }),
      vscode.commands.registerCommand(CMD_SELECT_ALL, () => {
        if (activePicker) handleSelectAll(activePicker)
      }),
      vscode.commands.registerCommand(CMD_NEXT, () => {
        if (activePicker) moveActiveItem(activePicker, 1)
      }),
      vscode.commands.registerCommand(CMD_PREV, () => {
        if (activePicker) moveActiveItem(activePicker, -1)
      }),
    )
  }

  const cleanup = () => {
    if (activePicker === picker) {
      activePicker = undefined
      void vscode.commands.executeCommand('setContext', CONTEXT_KEY, false)
    }
  }

  const hideListener = picker.onDidHide(cleanup)

  return vscode.Disposable.from(hideListener)
}

function handleToggle<T extends vscode.QuickPickItem>(picker: vscode.QuickPick<T>): void {
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
}

function handleSelectAll<T extends vscode.QuickPickItem>(picker: vscode.QuickPick<T>): void {
  const allItems = picker.items.filter((item) => item.kind !== vscode.QuickPickItemKind.Separator)
  const query = picker.value.trim().toLowerCase()

  const visibleItems = query
    ? allItems.filter((item) => {
        if (item.alwaysShow) return true
        if (picker.activeItems.includes(item as unknown as T)) return true

        const label = item.label.toLowerCase()
        const desc = (item.description || '').toLowerCase()
        return label.includes(query) || desc.includes(query)
      })
    : allItems

  if (visibleItems.length === 0) return

  const selectedSet = new Set(picker.selectedItems)
  const allVisibleSelected = visibleItems.every((item) => selectedSet.has(item as unknown as T))

  if (allVisibleSelected) {
    const visibleSet = new Set(visibleItems)
    picker.selectedItems = picker.selectedItems.filter((i) => !visibleSet.has(i as unknown as T))
  } else {
    const toAdd = visibleItems.filter((item) => !selectedSet.has(item as unknown as T))
    picker.selectedItems = [...picker.selectedItems, ...toAdd] as T[]
  }
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
