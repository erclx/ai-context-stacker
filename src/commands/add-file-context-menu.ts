import * as vscode from 'vscode'

import { ContextStackProvider, IgnorePatternProvider } from '../providers'
import { Logger } from '../utils'

export function registerAddFileContextMenuCommand(
  context: vscode.ExtensionContext,
  provider: ContextStackProvider,
  ignoreProvider: IgnorePatternProvider,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.addFileToStack',
    async (clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
      // 1. Resolve Targets
      const targets = resolveTargets(clickedUri, selectedUris)
      if (targets.length === 0) {
        vscode.window.showWarningMessage('No selection found.')
        return
      }

      // 2. Categorize (File vs Folder)
      const { files, folders } = await categorizeTargets(targets)

      // 3. Add direct files immediately
      if (files.length > 0) {
        provider.addFiles(files)
      }

      // 4. Scan folders (if any) and add results
      if (folders.length > 0) {
        await handleFolderScanning(folders, provider, ignoreProvider)
      } else if (files.length > 0) {
        // Only show status if we didn't enter the folder scanning flow
        vscode.window.setStatusBarMessage(`Added ${files.length} files.`, 2000)
      }
    },
  )

  context.subscriptions.push(command)
}

/**
 * Determines the target URIs based on how the command was triggered.
 */
function resolveTargets(clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]): vscode.Uri[] {
  if (selectedUris && selectedUris.length > 0) {
    return selectedUris
  }
  if (clickedUri) {
    return [clickedUri]
  }
  if (vscode.window.activeTextEditor) {
    return [vscode.window.activeTextEditor.document.uri]
  }
  return []
}

/**
 * Separates URIs into plain files and directories.
 */
async function categorizeTargets(targets: vscode.Uri[]) {
  const files: vscode.Uri[] = []
  const folders: vscode.Uri[] = []

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Processing selection...' },
    async () => {
      for (const target of targets) {
        try {
          const stat = await vscode.workspace.fs.stat(target)
          if (stat.type === vscode.FileType.File) files.push(target)
          if (stat.type === vscode.FileType.Directory) folders.push(target)
        } catch (error) {
          Logger.warn(`Skipping unreadable item: ${target.fsPath}`)
        }
      }
    },
  )
  return { files, folders }
}

/**
 * Orchestrates the scanning of folders with a progress bar and cancellation support.
 */
async function handleFolderScanning(
  folders: vscode.Uri[],
  provider: ContextStackProvider,
  ignoreProvider: IgnorePatternProvider,
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Scanning ${folders.length} folder(s)...`,
      cancellable: true,
    },
    async (_, token) => {
      const excludes = await ignoreProvider.getExcludePatterns()

      for (const folder of folders) {
        if (token.isCancellationRequested) break

        const foundFiles = await scanFolder(folder, excludes, token)
        if (foundFiles.length > 0) {
          provider.addFiles(foundFiles)
        }
      }

      if (!token.isCancellationRequested) {
        vscode.window.showInformationMessage('Finished adding files from folders.')
      }
    },
  )
}

/**
 * Performs the actual file search within a single folder.
 */
async function scanFolder(
  folder: vscode.Uri,
  excludes: string,
  token: vscode.CancellationToken,
): Promise<vscode.Uri[]> {
  try {
    const searchPattern = new vscode.RelativePattern(folder, '**/*')
    return await vscode.workspace.findFiles(searchPattern, excludes, undefined, token)
  } catch (err) {
    Logger.error(`Failed to scan folder: ${folder.fsPath}`, err)
    return []
  }
}
