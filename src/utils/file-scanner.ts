import * as vscode from 'vscode'

import { IgnoreManager, StackProvider } from '../providers'
import { Logger } from './logger'

export const BATCH_SIZE_STAT = 50
export const BATCH_SIZE_GLOB = 5

export async function categorizeTargets(targets: vscode.Uri[]) {
  const files: vscode.Uri[] = []
  const folders: vscode.Uri[] = []

  if (!targets.length) return { files, folders }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Processing selection...' },
    async () => {
      for (let i = 0; i < targets.length; i += BATCH_SIZE_STAT) {
        const batch = targets.slice(i, i + BATCH_SIZE_STAT)
        await processStatBatch(batch, files, folders)
      }
    },
  )

  return { files, folders }
}

export async function handleFolderScanning(
  folders: vscode.Uri[],
  provider: StackProvider,
  ignoreProvider: IgnoreManager,
): Promise<void> {
  if (!folders.length) return

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Scanning ${folders.length} folder(s)...`,
      cancellable: true,
    },
    async (_, token) => {
      const excludes = await ignoreProvider.getExcludePatterns()

      await scanMultipleFolders(folders, excludes, (files) => provider.addFiles(files), token)

      if (!token.isCancellationRequested) {
        vscode.window.showInformationMessage('Finished adding files.')
      }
    },
  )
}

export async function scanMultipleFolders(
  folders: vscode.Uri[],
  excludes: string,
  onFound: (files: vscode.Uri[]) => void,
  token?: vscode.CancellationToken,
): Promise<void> {
  for (let i = 0; i < folders.length; i += BATCH_SIZE_GLOB) {
    if (token?.isCancellationRequested) break

    const batch = folders.slice(i, i + BATCH_SIZE_GLOB)
    await processScanBatch(batch, excludes, onFound, token)
  }
}

async function processStatBatch(batch: vscode.Uri[], files: vscode.Uri[], folders: vscode.Uri[]): Promise<void> {
  await Promise.all(
    batch.map(async (target) => {
      try {
        const stat = await vscode.workspace.fs.stat(target)
        if (stat.type === vscode.FileType.File) files.push(target)
        if (stat.type === vscode.FileType.Directory) folders.push(target)
      } catch {
        Logger.warn(`Skipping unreadable item: ${target.fsPath}`)
      }
    }),
  )
}

async function processScanBatch(
  batch: vscode.Uri[],
  excludes: string,
  onFound: (files: vscode.Uri[]) => void,
  token?: vscode.CancellationToken,
): Promise<void> {
  await Promise.all(
    batch.map(async (folder) => {
      if (token?.isCancellationRequested) return

      const foundFiles = await scanFolder(folder, excludes, token)
      if (foundFiles.length > 0) onFound(foundFiles)
    }),
  )
}

async function scanFolder(
  folder: vscode.Uri,
  excludes: string,
  token?: vscode.CancellationToken,
): Promise<vscode.Uri[]> {
  try {
    const pattern = new vscode.RelativePattern(folder, '**/*')
    return await vscode.workspace.findFiles(pattern, excludes, undefined, token)
  } catch (err) {
    Logger.error(`Failed to scan folder: ${folder.fsPath}`, err)
    return []
  }
}
