import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'
import { Logger } from '../utils'

/**
 * Registers the command to add all currently open, visible text files to the stack.
 *
 * @param extensionContext The extension context.
 * @param contextStackProvider The ContextStackProvider instance.
 */
export function registerAddOpenFilesCommand(
  extensionContext: vscode.ExtensionContext,
  contextStackProvider: ContextStackProvider,
): void {
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

    contextStackProvider.addFiles(uris)

    Logger.info(`Added ${uris.length} open files to stack.`)
    vscode.window.showInformationMessage(`Added ${uris.length} open files to stack!`)
  })

  extensionContext.subscriptions.push(command)
}
