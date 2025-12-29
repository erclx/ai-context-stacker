import * as vscode from 'vscode'

import { PreviewWebview } from '../ui/preview-webview'
import { Command, CommandDependencies } from './types'

export function getPreviewContextCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.previewContext',
      execute: () => {
        if (deps.services.stackProvider.getFiles().length === 0) {
          void vscode.window.showWarningMessage('No files in stack to preview.')
          return
        }

        PreviewWebview.createOrShow(deps.context.extensionUri, deps.services.stackProvider)
      },
    },
  ]
}
