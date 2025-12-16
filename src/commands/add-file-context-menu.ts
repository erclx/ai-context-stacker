import * as vscode from 'vscode'

import { ContextStackProvider, IgnorePatternProvider } from '../providers'
import { Logger } from '../utils'

/**
 * Registers the command for adding files/folders from the VS Code file explorer context menu.
 * Handles both single and multi-selections, differentiating between files and folders.
 *
 * @param context The extension context.
 * @param provider The ContextStackProvider instance.
 * @param ignoreProvider The provider for file exclusion patterns.
 */
export function registerAddFileContextMenuCommand(
  context: vscode.ExtensionContext,
  provider: ContextStackProvider,
  ignoreProvider: IgnorePatternProvider,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.addFileToStack',
    async (clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
      // 1. Resolve Targets
      // The command receives arguments differently depending on the source (single click, multi-select, command palette)
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
        // Folder scanning is an expensive, long-running operation, so it has its own progress UI
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
 *
 * @returns An array of URIs selected by the user.
 */
function resolveTargets(clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]): vscode.Uri[] {
  // 1. Context menu multi-select takes precedence
  if (selectedUris && selectedUris.length > 0) {
    return selectedUris
  }
  // 2. Context menu single click
  if (clickedUri) {
    return [clickedUri]
  }
  // 3. Fallback to active editor document (e.g., if triggered from command palette)
  if (vscode.window.activeTextEditor) {
    return [vscode.window.activeTextEditor.document.uri]
  }
  return []
}

/**
 * Separates URIs into plain files and directories using VS Code's file system stat API.
 * This operation is wrapped in a progress bar as it involves disk I/O.
 *
 * @param targets The mixed array of file and directory URIs.
 * @returns An object containing separated arrays of files and folders.
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
          // Skip if we can't read the file/folder stats (e.g., permission issues)
          Logger.warn(`Skipping unreadable item: ${target.fsPath}`)
        }
      }
    },
  )
  return { files, folders }
}

/**
 * Orchestrates the scanning of folders with a progress bar and cancellation support.
 *
 * @param folders An array of folder URIs to scan.
 * @param provider The ContextStackProvider for adding found files.
 * @param ignoreProvider The provider for exclusion patterns.
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
      cancellable: true, // Allow user to cancel the potentially long search
    },
    async (_, token) => {
      const excludes = await ignoreProvider.getExcludePatterns()

      for (const folder of folders) {
        if (token.isCancellationRequested) break

        const foundFiles = await scanFolder(folder, excludes, token)
        if (foundFiles.length > 0) {
          // Add files in batches to the stack provider for performance
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
 *
 * @param folder The root folder URI for the search.
 * @param excludes The glob pattern string for exclusion.
 * @param token A cancellation token to stop the search if the user cancels the progress.
 * @returns A promise resolving to an array of file URIs found.
 */
async function scanFolder(
  folder: vscode.Uri,
  excludes: string,
  token: vscode.CancellationToken,
): Promise<vscode.Uri[]> {
  try {
    // Create a relative pattern to efficiently search only within the given folder
    const searchPattern = new vscode.RelativePattern(folder, '**/*')
    return await vscode.workspace.findFiles(searchPattern, excludes, undefined, token)
  } catch (err) {
    Logger.error(`Failed to scan folder: ${folder.fsPath}`, err)
    return []
  }
}
