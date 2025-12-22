import * as vscode from 'vscode'

import { IgnoreManager, StackProvider } from '../providers'
import { Logger } from './logger'

/**
 * Separates a mixed list of URIs into plain files and directories.
 * @param targets - Raw selection of URIs
 * @returns Tuple-like object separating files and folders
 */
export async function categorizeTargets(targets: vscode.Uri[]) {
  const files: vscode.Uri[] = []
  const folders: vscode.Uri[] = []

  // Keep UI feedback for potentially long stat operations
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Processing selection...' },
    async () => {
      for (const target of targets) {
        try {
          const stat = await vscode.workspace.fs.stat(target)
          if (stat.type === vscode.FileType.File) files.push(target)
          if (stat.type === vscode.FileType.Directory) folders.push(target)
        } catch (error) {
          // Gracefully skip items we lack permissions for (e.g. system folders)
          Logger.warn(`Skipping unreadable item: ${target.fsPath}`)
        }
      }
    },
  )
  return { files, folders }
}

/**
 * Orchestrates recursive scanning of multiple folders with cancellation support.
 * Acts as the UI Controller for the scanning operation.
 */
export async function handleFolderScanning(
  folders: vscode.Uri[],
  provider: StackProvider,
  ignoreProvider: IgnoreManager,
): Promise<void> {
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
        vscode.window.showInformationMessage('Finished adding files from folders.')
      }
    },
  )
}

/**
 * Core Logic: Iterates through folders and performs glob matching.
 * Agnostic of UI/VSCode Windows.
 */
export async function scanMultipleFolders(
  folders: vscode.Uri[],
  excludes: string,
  onFound: (files: vscode.Uri[]) => void,
  token?: vscode.CancellationToken,
): Promise<void> {
  for (const folder of folders) {
    if (token?.isCancellationRequested) break

    const foundFiles = await scanFolder(folder, excludes, token)

    if (foundFiles.length > 0) {
      onFound(foundFiles)
    }
  }
}

/**
 * Performs glob search within a single directory root.
 * Uses RelativePattern to scope search strictly to the target folder.
 */
async function scanFolder(
  folder: vscode.Uri,
  excludes: string,
  token?: vscode.CancellationToken,
): Promise<vscode.Uri[]> {
  try {
    // RelativePattern is essential: it restricts glob to this folder only
    const searchPattern = new vscode.RelativePattern(folder, '**/*')
    return await vscode.workspace.findFiles(searchPattern, excludes, undefined, token)
  } catch (err) {
    Logger.error(`Failed to scan folder: ${folder.fsPath}`, err)
    return []
  }
}
