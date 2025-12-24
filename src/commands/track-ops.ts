import * as vscode from 'vscode'

import { ContextTrack } from '../models'
import { TrackManager } from '../providers'
import { ErrorHandler } from '../utils'

interface TrackQuickPick extends vscode.QuickPickItem {
  id: string
}

export function registerTrackCommands(
  context: vscode.ExtensionContext,
  trackManager: TrackManager,
  filesView: vscode.TreeView<ContextTrack>,
): void {
  // New Track
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'aiContextStacker.newTrack',
      ErrorHandler.safeExecute('New Track', () => handleNewTrack(trackManager)),
    ),
  )

  // Switch Track
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.switchTrack', (arg?: string | ContextTrack) => {
      const action = () => handleSwitchTrack(trackManager, arg)
      return ErrorHandler.safeExecute('Switch Track', action)()
    }),
  )

  // Rename Track
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.renameTrack', (item?: ContextTrack) => {
      const action = () => handleRenameTrack(trackManager, filesView, item)
      return ErrorHandler.safeExecute('Rename Track', action)()
    }),
  )

  // Delete Track
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.deleteTrack', (item?: ContextTrack) => {
      const action = () => handleDeleteTrack(trackManager, filesView, item)
      return ErrorHandler.safeExecute('Delete Track', action)()
    }),
  )

  // Delete All Tracks (Reset)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'aiContextStacker.deleteAllTracks',
      ErrorHandler.safeExecute('Delete All Tracks', () => handleDeleteAllTracks(trackManager)),
    ),
  )

  // Move Track Up
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.moveTrackUp', (item?: ContextTrack) => {
      const action = () => handleMoveTrack(trackManager, item, 'up')
      return ErrorHandler.safeExecute('Move Track Up', action)()
    }),
  )

  // Move Track Down
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.moveTrackDown', (item?: ContextTrack) => {
      const action = () => handleMoveTrack(trackManager, item, 'down')
      return ErrorHandler.safeExecute('Move Track Down', action)()
    }),
  )
}

async function handleNewTrack(manager: TrackManager): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'Enter name for new context track',
    placeHolder: 'e.g., "Refactoring Auth"',
  })

  if (name) {
    await manager.createTrack(name)
  }
}

async function handleSwitchTrack(manager: TrackManager, arg?: string | ContextTrack): Promise<void> {
  const targetId = await resolveTrackId(manager, arg)

  if (!targetId) return

  // Prevent redundant context switching
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
  })

  if (name) {
    manager.renameTrack(target.id, name)
  }
}

async function handleDeleteTrack(
  manager: TrackManager,
  view: vscode.TreeView<ContextTrack>,
  item?: ContextTrack,
): Promise<void> {
  const target = resolveTargetTrack(manager, view, item)

  const answer = await vscode.window.showWarningMessage(`Delete track "${target.name}"?`, { modal: true }, 'Delete')

  if (answer === 'Delete') {
    manager.deleteTrack(target.id)
  }
}

async function handleDeleteAllTracks(manager: TrackManager): Promise<void> {
  const warning = 'Are you sure you want to delete ALL tracks? This cannot be undone.'
  const answer = await vscode.window.showWarningMessage(warning, { modal: true }, 'Delete All')

  if (answer === 'Delete All') {
    manager.deleteAllTracks()
    vscode.window.showInformationMessage('All context tracks deleted and workspace reset.')
  }
}

async function handleMoveTrack(
  manager: TrackManager,
  item: ContextTrack | undefined,
  direction: 'up' | 'down',
): Promise<void> {
  if (!item) return
  manager.moveTrackRelative(item.id, direction)
}

// --- Helpers ---

/**
 * Resolves the target track ID from an argument or prompts the user via QuickPick.
 */
async function resolveTrackId(manager: TrackManager, arg?: string | ContextTrack): Promise<string | undefined> {
  if (arg) {
    return typeof arg === 'string' ? arg : arg.id
  }
  return await pickTrack(manager)
}

/**
 * Resolves the target track object based on direct selection, view selection, or active state.
 */
function resolveTargetTrack(
  manager: TrackManager,
  view: vscode.TreeView<ContextTrack>,
  item?: ContextTrack,
): ContextTrack {
  if (item) return item
  if (view.selection.length > 0) return view.selection[0]
  return manager.getActiveTrack()
}

/**
 * Displays a QuickPick for selecting a context track.
 * Handles the mapping of track data to UI items.
 */
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
