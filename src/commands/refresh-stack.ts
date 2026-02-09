import * as path from 'path'
import * as vscode from 'vscode'

import { isStagedFolder } from '../models'
import { collectFilesFromFolders, Logger } from '../utils'
import { Command, CommandDependencies } from './types'

export function getRefreshStackCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.refreshStack',
      execute: async () => {
        try {
          await deps.services.stackProvider.reScanFileSystem()
          vscode.window.setStatusBarMessage('$(check) AI Context Stack refreshed', 3000)
        } catch (error) {
          Logger.error('Failed to refresh stack', error as Error)
          void vscode.window.showErrorMessage('Failed to refresh context stack. Check output logs.')
        }
      },
    },
  ]
}

export function getRefreshFolderCommand(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.refreshFolder',
      execute: async (arg?: vscode.Uri | unknown) => {
        let uri: vscode.Uri | undefined

        if (arg instanceof vscode.Uri) {
          uri = arg
        } else if (arg && isStagedFolder(arg as any)) {
          uri = (arg as any).resourceUri
        }

        if (!uri) return

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Scanning ${path.basename(uri.fsPath)}...`,
            cancellable: true,
          },
          async (_, token) => {
            try {
              if (!uri) return
              const uris = await collectFilesFromFolders([uri], deps.services.ignoreManager, token)
              if (token.isCancellationRequested) return

              if (uris.length > 0) {
                await deps.services.stackProvider.addFiles(uris, true)
                vscode.window.setStatusBarMessage(`Found ${uris.length} files in folder.`, 3000)
              } else {
                vscode.window.setStatusBarMessage('No relevant files found.', 3000)
              }
            } catch (error) {
              Logger.error('Failed to scan folder', error as Error)
              void vscode.window.showErrorMessage('Failed to scan folder.')
            }
          },
        )
      },
    },
  ]
}
