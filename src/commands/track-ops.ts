import * as vscode from 'vscode'

import { ContextTrack } from '../models'
import { TrackManager } from '../providers'
import { ErrorHandler } from '../utils'
import { Command, CommandDependencies } from './types'

interface TrackQuickPick extends vscode.QuickPickItem {
  id: string
}

export function getTrackCommands(deps: CommandDependencies): Command[] {
  const { trackManager } = deps.services
  const { tracksView } = deps.views

  return [
    {
      id: 'aiContextStacker.newTrack',
      execute: ErrorHandler.safeExecute('New Track', () => handleNewTrack(trackManager)),
    },
    {
      id: 'aiContextStacker.switchTrack',
      execute: (arg?: string | ContextTrack) => {
        const action = () => handleSwitchTrack(trackManager, arg)
        return ErrorHandler.safeExecute('Switch Track', action)()
      },
    },
    {
      id: 'aiContextStacker.renameTrack',
      execute: (item?: ContextTrack) => {
        const action = () => handleRenameTrack(trackManager, tracksView, item)
        return ErrorHandler.safeExecute('Rename Track', action)()
      },
    },
    {
      id: 'aiContextStacker.deleteTrack',
      execute: (item?: ContextTrack) => {
        const action = () => handleDeleteTrack(trackManager, tracksView, item)
        return ErrorHandler.safeExecute('Delete Track', action)()
      },
    },
    {
      id: 'aiContextStacker.deleteAllTracks',
      execute: ErrorHandler.safeExecute('Delete All Tracks', () => handleDeleteAllTracks(trackManager)),
    },
    {
      id: 'aiContextStacker.moveTrackUp',
      execute: (item?: ContextTrack) => {
        const action = () => handleMoveTrack(trackManager, tracksView, item, 'up')
        return ErrorHandler.safeExecute('Move Track Up', action)()
      },
    },
    {
      id: 'aiContextStacker.moveTrackDown',
      execute: (item?: ContextTrack) => {
        const action = () => handleMoveTrack(trackManager, tracksView, item, 'down')
        return ErrorHandler.safeExecute('Move Track Down', action)()
      },
    },
  ]
}

async function handleNewTrack(manager: TrackManager): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'Enter name for new context track',
    placeHolder: 'e.g., "Refactoring Auth"',
    validateInput: (value) => {
      const trimmed = value.trim()
      if (trimmed.length === 0) return 'Name cannot be empty'
      if (manager.isNameTaken(trimmed)) return 'Track name is already taken'
      return null
    },
  })

  if (name) {
    manager.createTrack(name.trim())
  }
}

async function handleSwitchTrack(manager: TrackManager, arg?: string | ContextTrack): Promise<void> {
  const targetId = await resolveTrackId(manager, arg)

  if (!targetId) return

  if (targetId === manager.getActiveTrack().id) {
    return
  }

  await manager.switchToTrack(targetId)
}

async function handleRenameTrack(
  manager: TrackManager,
  view: vscode.TreeView<ContextTrack>,
  item?: ContextTrack,
): Promise<void> {
  const target = resolveTargetTrack(manager, view, item)

  const name = await vscode.window.showInputBox({
    prompt: `Rename track "${target.name}"`,
    value: target.name,
    validateInput: (value) => {
      const trimmed = value.trim()
      if (trimmed.length === 0) return 'Name cannot be empty'
      if (trimmed !== target.name && manager.isNameTaken(trimmed)) {
        return 'Track name is already taken'
      }
      return null
    },
  })

  if (name) {
    manager.renameTrack(target.id, name.trim())
  }
}

async function handleDeleteTrack(
  manager: TrackManager,
  view: vscode.TreeView<ContextTrack>,
  item?: ContextTrack,
): Promise<void> {
  const target = resolveTargetTrack(manager, view, item)

  if (manager.allTracks.length <= 1) {
    void vscode.window.showWarningMessage('Cannot delete the last track. Use "Reset All" to clear workspace.')
    return
  }

  if (target.files.length > 0) {
    const answer = await vscode.window.showWarningMessage(
      `Delete track "${target.name}" and its files?`,
      { modal: true },
      'Delete',
    )
    if (answer !== 'Delete') return
  }

  manager.deleteTrack(target.id)
}

async function handleDeleteAllTracks(manager: TrackManager): Promise<void> {
  const warning = 'This will remove ALL tracks and reset the workspace to default. This cannot be undone.'
  const answer = await vscode.window.showWarningMessage(warning, { modal: true }, 'Reset All')

  if (answer === 'Reset All') {
    manager.deleteAllTracks()
    void vscode.window.showInformationMessage('Workspace reset to default.')
  }
}

async function handleMoveTrack(
  manager: TrackManager,
  view: vscode.TreeView<ContextTrack>,
  item: ContextTrack | undefined,
  direction: 'up' | 'down',
): Promise<void> {
  const target = resolveTargetTrack(manager, view, item)
  manager.moveTrackRelative(target.id, direction)
}

async function resolveTrackId(manager: TrackManager, arg?: string | ContextTrack): Promise<string | undefined> {
  if (arg) {
    return typeof arg === 'string' ? arg : arg.id
  }
  return await pickTrack(manager)
}

function resolveTargetTrack(
  manager: TrackManager,
  view: vscode.TreeView<ContextTrack>,
  item?: ContextTrack,
): ContextTrack {
  if (item) return item
  if (view.selection.length > 0) return view.selection[0]
  return manager.getActiveTrack()
}

async function pickTrack(manager: TrackManager): Promise<string | undefined> {
  const activeId = manager.getActiveTrack().id

  const items: TrackQuickPick[] = manager.allTracks.map((t) => ({
    label: t.name,
    description: t.id === activeId ? '$(check) Active' : '',
    picked: t.id === activeId,
    id: t.id,
  }))

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a Context Track',
  })

  return selected?.id
}
