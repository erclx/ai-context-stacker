import * as vscode from 'vscode'

import { Logger } from '../utils'

const CONFIG_SECTION = 'aiContextStacker'
const SETTING_TREE = 'includeFileTree'

/**
 * Registers the 'Configure Output' command.
 * replaces the single-toggle action with a multi-select Quick Pick.
 */
export function registerConfigureOutputCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.configureOutput', executeConfigureOutput),
  )
}

async function executeConfigureOutput() {
  try {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    const currentTree = config.get<boolean>(SETTING_TREE, true)

    const selection = await vscode.window.showQuickPick(createPickerItems(currentTree), {
      placeHolder: 'Select output options',
      canPickMany: true,
      title: 'Configure Output',
    })

    if (selection) {
      await applyConfiguration(config, selection)
    }
  } catch (error) {
    Logger.error('Failed to configure output', error)
  }
}

function createPickerItems(treeEnabled: boolean): vscode.QuickPickItem[] {
  return [
    {
      label: 'Include ASCII File Tree',
      picked: treeEnabled,
      description: 'Adds a visual file map to the top of the copied context',
    },
  ]
}

async function applyConfiguration(config: vscode.WorkspaceConfiguration, selected: vscode.QuickPickItem[]) {
  const treeSelected = selected.some((item) => item.label === 'Include ASCII File Tree')

  // Update Global settings to ensure persistence across sessions
  await config.update(SETTING_TREE, treeSelected, vscode.ConfigurationTarget.Global)
}
