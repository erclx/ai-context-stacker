import * as vscode from 'vscode'

import { Logger } from '../utils'

const CONFIG_SECTION = 'aiContextStacker'
const SETTING_THRESHOLD = 'largeFileThreshold'

export function registerSetThresholdCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand('aiContextStacker.setThreshold', executeSetThreshold))
}

async function executeSetThreshold() {
  try {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    const current = config.get<number>(SETTING_THRESHOLD, 5000)

    const input = await vscode.window.showInputBox({
      title: 'Set Large File Threshold',
      prompt: 'Enter token count for "Heavy" warning (Orange). "Critical" (Red) is 2x this value.',
      value: current.toString(),
      validateInput: validateInteger,
      ignoreFocusOut: true,
    })

    if (input) {
      await updateThreshold(config, input)
    }
  } catch (error) {
    Logger.error('Failed to set threshold', error)
  }
}

async function updateThreshold(config: vscode.WorkspaceConfiguration, input: string) {
  const value = parseInt(input, 10)
  await config.update(SETTING_THRESHOLD, value, vscode.ConfigurationTarget.Global)
  vscode.window.setStatusBarMessage(`Threshold updated to ${value} tokens`, 3000)
}

function validateInteger(value: string): string | null {
  const num = Number(value)
  if (isNaN(num) || !Number.isInteger(num)) {
    return 'Please enter a valid integer.'
  }
  if (num <= 0) {
    return 'Threshold must be greater than 0.'
  }
  return null
}
