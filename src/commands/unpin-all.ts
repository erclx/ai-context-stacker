import * as vscode from 'vscode'

import { TrackManager } from '../providers/track-manager'
import { Logger } from '../utils'

export function registerUnpinAllCommand(context: vscode.ExtensionContext, trackManager: TrackManager) {
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.unpinAll', async () => {
      try {
        trackManager.unpinAllInActive()
        vscode.window.setStatusBarMessage('$(pinned) Unpinned all files', 2000)
      } catch (error) {
        Logger.error('Failed to unpin all files', error)
      }
    }),
  )
}
