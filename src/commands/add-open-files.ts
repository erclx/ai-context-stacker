import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'
import { Logger } from '../utils'

/**
 * Registers the command to add all currently open, visible text files to the stack.
 *
 * @param context The extension context.
 * @param provider The ContextStackProvider instance.
 */
export function registerAddOpenFilesCommand(context: vscode.ExtensionContext, provider: ContextStackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addOpenFiles', () => {
    const uris: vscode.Uri[] = []

    // Iterate through all tab groups and tabs to find open files
    vscode.window.tabGroups.all.forEach((group) => {
      group.tabs.forEach((tab) => {
        // We only care about standard text documents, excluding custom editors/views
        if (tab.input instanceof vscode.TabInputText) {
          uris.push(tab.input.uri)
        }
      })
    })

    if (uris.length === 0) {
      vscode.window.showInformationMessage('No text files are currently open.')
      return
    }

    provider.addFiles(uris)

    Logger.info(`Added ${uris.length} open files to stack.`)
    vscode.window.showInformationMessage(`Added ${uris.length} open files to stack!`)
  })

  context.subscriptions.push(command)
}
