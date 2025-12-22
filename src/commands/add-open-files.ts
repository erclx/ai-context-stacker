import * as vscode from 'vscode'

import { StackProvider } from '../providers'
import { Logger } from '../utils'

export function registerAddOpenFilesCommand(context: vscode.ExtensionContext, stackProvider: StackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addOpenFiles', () => {
    const uris: vscode.Uri[] = []

    vscode.window.tabGroups.all.forEach((group) => {
      group.tabs.forEach((tab) => {
        // Only text documents, filters out custom editors/webviews/images
        if (tab.input instanceof vscode.TabInputText) {
          uris.push(tab.input.uri)
        }
      })
    })

    if (uris.length === 0) {
      vscode.window.showInformationMessage('No text files are currently open.')
      return
    }

    stackProvider.addFiles(uris)

    Logger.info(`Added ${uris.length} open files to stack.`)
    vscode.window.showInformationMessage(`Added ${uris.length} open files to stack!`)
  })

  context.subscriptions.push(command)
}
