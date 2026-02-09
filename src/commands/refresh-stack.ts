import * as path from 'path'
import * as vscode from 'vscode'

import { isStagedFolder } from '../models'
import { collectFilesFromFolders, Logger } from '../utils'
import { Command, CommandDependencies } from './types'

export function getRefreshStackCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.refreshStack',
      execute: () => executeGlobalSync(deps),
    },
    {
      id: 'aiContextStacker.syncFolder',
      execute: (primary, selected) => executeFolderSync(deps, primary, selected),
    },
    {
      id: 'aiContextStacker.syncExplorerFolder',
      execute: (primary, selected) => executeFolderSync(deps, primary, selected),
    },
  ]
}

async function executeGlobalSync(deps: CommandDependencies): Promise<void> {
  try {
    await deps.services.stackProvider.reScanFileSystem()
    vscode.window.setStatusBarMessage('$(check) AI Context synced', 3000)
  } catch (error) {
    Logger.error('Failed to sync stack', error as Error)
    void vscode.window.showErrorMessage('Failed to sync context stack. Check output logs.')
  }
}

async function executeFolderSync(deps: CommandDependencies, primary?: unknown, selected?: unknown[]): Promise<void> {
  const foldersToScan = extractFoldersFromSelection(primary, selected)

  if (foldersToScan.length === 0) {
    return
  }

  const label = foldersToScan.length === 1 ? path.basename(foldersToScan[0].fsPath) : `${foldersToScan.length} folders`

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Syncing ${label}...`,
      cancellable: true,
    },
    async (_, token) => {
      try {
        const uris = await collectFilesFromFolders(foldersToScan, deps.services.ignoreManager, token)
        if (token.isCancellationRequested) return

        if (uris.length > 0) {
          await deps.services.stackProvider.addFiles(uris, true)
          vscode.window.setStatusBarMessage(`Found ${uris.length} files in ${label}.`, 3000)
        } else {
          vscode.window.setStatusBarMessage(`No new files found in ${label}.`, 3000)
        }
      } catch (error) {
        Logger.error('Failed to sync folders', error as Error)
        void vscode.window.showErrorMessage('Failed to sync selected folders.')
      }
    },
  )
}

function extractFoldersFromSelection(primary?: unknown, selected?: unknown[]): vscode.Uri[] {
  const folders: vscode.Uri[] = []
  const rawItems = selected && Array.isArray(selected) && selected.length > 0 ? selected : primary ? [primary] : []

  for (const item of rawItems) {
    if (item instanceof vscode.Uri) {
      folders.push(item)
    } else if ((item as any).resourceUri instanceof vscode.Uri) {
      folders.push((item as any).resourceUri)
    } else if (isStagedFolder(item as any)) {
      folders.push((item as any).resourceUri)
    }
  }

  return folders
}
