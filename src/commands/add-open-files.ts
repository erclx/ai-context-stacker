import * as vscode from 'vscode'

import { Logger } from '../utils'
import { Command, CommandDependencies } from './types'

export function getAddOpenFilesCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.addOpenFiles',
      execute: async () => {
        const candidateUris: vscode.Uri[] = []

        vscode.window.tabGroups.all.forEach((group) => {
          group.tabs.forEach((tab) => {
            if (tab.input instanceof vscode.TabInputText) {
              candidateUris.push(tab.input.uri)
            }
          })
        })

        const stackProvider = deps.services.stackProvider
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
      },
    },
  ]
}
