import * as vscode from 'vscode'

import { ContextTrackManager } from '../providers'

/**
 * Registers commands for managing context tracks (tabs).
 */
export function registerTrackCommands(context: vscode.ExtensionContext, manager: ContextTrackManager): void {
  // 1. New Track
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.newTrack', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter name for new context track',
        placeHolder: 'e.g., "Refactoring Auth"',
      })
      if (name) manager.createTrack(name)
    }),
  )

  // 2. Switch Track
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.switchTrack', async () => {
      const tracks = manager.allTracks
      const activeId = manager.getActiveTrack().id

      const selected = await vscode.window.showQuickPick(
        tracks.map((t) => {
          const isActive = t.id === activeId
          return {
            label: t.name,
            // Visual indicator: Check mark for active, empty for others
            description: isActive ? '$(check) Active' : '',
            // Functional indicator: Pre-selects the active item in the list
            picked: isActive,
            id: t.id,
          }
        }),
        { placeHolder: 'Select a Context Track' },
      )

      if (selected) manager.switchToTrack(selected.id)
    }),
  )

  // 3. Rename Track
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.renameTrack', async () => {
      const active = manager.getActiveTrack()
      const name = await vscode.window.showInputBox({
        prompt: 'Rename current track',
        value: active.name,
      })
      if (name) manager.renameTrack(active.id, name)
    }),
  )

  // 4. Delete Track
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.deleteTrack', async () => {
      const active = manager.getActiveTrack()
      const answer = await vscode.window.showWarningMessage(`Delete track "${active.name}"?`, { modal: true }, 'Delete')
      if (answer === 'Delete') manager.deleteTrack(active.id)
    }),
  )
}
