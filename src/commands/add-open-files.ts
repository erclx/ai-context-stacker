import * as vscode from 'vscode'

import { StackProvider } from '../providers'
import { Logger } from '../utils'

export function registerAddOpenFilesCommand(context: vscode.ExtensionContext, stackProvider: StackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addOpenFiles', async () => {
    const candidateUris: vscode.Uri[] = []

    vscode.window.tabGroups.all.forEach((group) => {
      group.tabs.forEach((tab) => {
        if (tab.input instanceof vscode.TabInputText) {
          candidateUris.push(tab.input.uri)
        }
      })
    })

    const unstagedUris = candidateUris.filter((uri) => !stackProvider.hasTrackedPath(uri))

    if (unstagedUris.length === 0) {
      void vscode.window.showInformationMessage('All open files are already in the stack.')
      return
    }

    const success = await stackProvider.addFiles(unstagedUris)

    if (success) {
      Logger.info(`Added ${unstagedUris.length} open files to stack.`)
      void vscode.window.showInformationMessage(`Added ${unstagedUris.length} file(s) to stack`)
    }
  })

  context.subscriptions.push(command)
}
