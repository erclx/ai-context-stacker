import * as vscode from 'vscode'

import { Logger } from '../utils'

export function registerOpenSettingsCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand('aiContextStacker.openSettings', executeOpenSettings))
}

async function executeOpenSettings() {
  try {
    await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:erclx.ai-context-stacker')
  } catch (error) {
    Logger.error('Failed to open settings UI', error)
  }
}
