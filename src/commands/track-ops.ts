import * as vscode from 'vscode'

import { type ContextTrack } from '../models'
import { ContextTrackManager } from '../providers'

export function registerTrackCommands(
  extensionContext: vscode.ExtensionContext,
  contextTrackManager: ContextTrackManager,
  filesView: vscode.TreeView<ContextTrack>,
): void {
  extensionContext.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.newTrack', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter name for new context track',
        placeHolder: 'e.g., "Refactoring Auth"',
      })
      if (name) contextTrackManager.createTrack(name)
    }),
  )

  extensionContext.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.switchTrack', async (arg?: string | ContextTrack) => {
      let targetId: string | undefined

      if (arg) {
        targetId = typeof arg === 'string' ? arg : arg.id
      } else {
        const tracks = contextTrackManager.allTracks
        const activeId = contextTrackManager.getActiveTrack().id

        const selected = await vscode.window.showQuickPick(
          tracks.map((t) => {
            const isActive = t.id === activeId
            return {
              label: t.name,
              description: isActive ? '$(check) Active' : '',
              picked: isActive,
              id: t.id,
            }
          }),
          { placeHolder: 'Select a Context Track' },
        )

        if (selected) targetId = selected.id
      }

      if (targetId) {
        if (targetId === contextTrackManager.getActiveTrack().id) {
          vscode.window.showInformationMessage(
            `You are already on the "${contextTrackManager.getActiveTrack().name}" track.`,
          )
          return
        }
        await contextTrackManager.switchToTrack(targetId)
      }
    }),
  )

  const getTargetTrack = (item?: ContextTrack): ContextTrack => {
    if (item) return item
    if (filesView.selection.length > 0) return filesView.selection[0]
    return contextTrackManager.getActiveTrack()
  }

  extensionContext.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.renameTrack', async (item?: ContextTrack) => {
      const targetTrack = getTargetTrack(item)

      const name = await vscode.window.showInputBox({
        prompt: `Rename track "${targetTrack.name}"`,
        value: targetTrack.name,
      })
      if (name) contextTrackManager.renameTrack(targetTrack.id, name)
    }),
  )

  // 4. Delete Track
  extensionContext.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.deleteTrack', async (item?: ContextTrack) => {
      const targetTrack = getTargetTrack(item)

      const answer = await vscode.window.showWarningMessage(
        `Delete track "${targetTrack.name}"?`,
        { modal: true },
        'Delete',
      )
      if (answer === 'Delete') contextTrackManager.deleteTrack(targetTrack.id)
    }),
  )
}
