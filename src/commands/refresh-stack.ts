import * as vscode from 'vscode'

import { StackProvider } from '../providers/stack-provider'
import { Logger } from '../utils'

export function registerRefreshStackCommand(context: vscode.ExtensionContext, provider: StackProvider): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.refreshStack', async () => {
      try {
        await provider.forceRefresh()
        vscode.window.setStatusBarMessage('$(check) AI Context Stack refreshed', 3000)
      } catch (error) {
        Logger.error('Failed to refresh stack', error as Error)
        void vscode.window.showErrorMessage('Failed to refresh context stack. Check output logs.')
      }
    }),
  )
}
