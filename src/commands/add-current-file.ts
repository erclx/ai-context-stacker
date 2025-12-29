import * as vscode from 'vscode'

import { Command, CommandDependencies } from './types'

export function getAddCurrentFileCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.addCurrentFile',
      execute: async () => {
        const editor = vscode.window.activeTextEditor

        if (!editor) {
          void vscode.window.showWarningMessage('No file open')
          return
        }

        const wasAdded = await deps.services.stackProvider.addFile(editor.document.uri)

        if (wasAdded) {
          void vscode.window.showInformationMessage('Added current file to stack')
        } else {
          void vscode.window.showWarningMessage('File is already in the stack')
        }
      },
    },
  ]
}
