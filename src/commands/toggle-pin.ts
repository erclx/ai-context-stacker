import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { ContextTrackManager } from '../providers'

/**
 * Toggles the pinned state of a staged file.
 */
export function registerTogglePinCommand(context: vscode.ExtensionContext, trackManager: ContextTrackManager): void {
  const command = vscode.commands.registerCommand('aiContextStacker.togglePin', (file: StagedFile) => {
    if (!file) return
    trackManager.toggleFilePin(file)
  })

  context.subscriptions.push(command)
}
