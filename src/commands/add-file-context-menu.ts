import * as vscode from 'vscode'

import { ContextStackProvider, IgnorePatternProvider } from '@/providers'
import { Logger } from '@/utils'

export function registerAddFileContextMenuCommand(
  context: vscode.ExtensionContext,
  provider: ContextStackProvider,
  ignoreProvider: IgnorePatternProvider,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.addFileToStack',
    async (clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
      let targets: vscode.Uri[] = []

      if (selectedUris && selectedUris.length > 0) {
        targets = selectedUris
      } else if (clickedUri) {
        targets = [clickedUri]
      } else {
        const activeEditor = vscode.window.activeTextEditor
        if (activeEditor) {
          targets = [activeEditor.document.uri]
        }
      }

      if (targets.length === 0) {
        vscode.window.showWarningMessage('No selection found.')
        return
      }

      const filesToAdd: vscode.Uri[] = []
      const foldersToScan: vscode.Uri[] = []

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Processing selection...',
          cancellable: false,
        },
        async () => {
          for (const target of targets) {
            try {
              const stat = await vscode.workspace.fs.stat(target)
              if (stat.type === vscode.FileType.File) {
                filesToAdd.push(target)
              } else if (stat.type === vscode.FileType.Directory) {
                foldersToScan.push(target)
              }
            } catch (error) {
              Logger.warn(`Skipping unreadable item: ${target.fsPath}`)
            }
          }
        },
      )

      if (filesToAdd.length > 0) {
        provider.addFiles(filesToAdd)
        if (foldersToScan.length === 0) {
          vscode.window.setStatusBarMessage(`Added ${filesToAdd.length} files.`, 2000)
        }
      }

      if (foldersToScan.length > 0) {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Scanning ${foldersToScan.length} folder(s)...`,
            cancellable: true,
          },
          async (_, token) => {
            const excludes = await ignoreProvider.getExcludePatterns()

            for (const folderUri of foldersToScan) {
              if (token.isCancellationRequested) break

              const searchPattern = new vscode.RelativePattern(folderUri, '**/*')

              try {
                const folderFiles = await vscode.workspace.findFiles(searchPattern, excludes, undefined, token)
                if (folderFiles.length > 0) {
                  provider.addFiles(folderFiles)
                }
              } catch (err) {
                Logger.error(`Failed to scan folder: ${folderUri.fsPath}`, err)
              }
            }

            vscode.window.showInformationMessage('Finished adding files from folders.')
          },
        )
      }
    },
  )

  context.subscriptions.push(command)
}
