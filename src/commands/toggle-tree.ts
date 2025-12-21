import * as vscode from 'vscode'

import { Logger } from '../utils'

const CONFIG_KEY = 'aiContextStacker'
const CONFIG_SETTING = 'includeFileTree'
// FIXED: Use dot notation to match standard practice
const CONTEXT_KEY = 'aiContextStacker.treeEnabled'

/**
 * Registers the 'Include File Tree' toggle command.
 * Manages the UI check mark state via Context Keys.
 */
export function registerToggleTreeCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.toggleTree', async () => {
      try {
        await toggleSetting()
      } catch (error) {
        Logger.error('Failed to toggle tree setting', error)
      }
    }),
  )

  syncContextKey()

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${CONFIG_KEY}.${CONFIG_SETTING}`)) {
        syncContextKey()
      }
    }),
  )
}

async function toggleSetting() {
  const config = vscode.workspace.getConfiguration(CONFIG_KEY)
  const inspect = config.inspect<boolean>(CONFIG_SETTING)
  const currentValue = config.get<boolean>(CONFIG_SETTING, true)
  const newValue = !currentValue

  let target = vscode.ConfigurationTarget.Global
  if (inspect?.workspaceValue !== undefined) {
    target = vscode.ConfigurationTarget.Workspace
  } else if (inspect?.workspaceFolderValue !== undefined) {
    target = vscode.ConfigurationTarget.WorkspaceFolder
  }

  await config.update(CONFIG_SETTING, newValue, target)
}

function syncContextKey() {
  const config = vscode.workspace.getConfiguration(CONFIG_KEY)
  const isEnabled = config.get<boolean>(CONFIG_SETTING, true)

  vscode.commands.executeCommand('setContext', CONTEXT_KEY, isEnabled)
}
