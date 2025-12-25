import * as vscode from 'vscode'

import { IgnoreManager, StackProvider } from '../providers'
import { Logger } from './logger'

// Concurrency limits to balance speed vs. Extension Host load
const BATCH_SIZE_STAT = 50 // High throughput for lightweight fs.stat calls
const BATCH_SIZE_GLOB = 5 // Lower limit for heavy findFiles operations

/**
 * Separates a mixed list of URIs into plain files and directories.
 * Uses batched parallelism to minimize file system latency.
 * @param targets - Raw selection of URIs
 * @returns Tuple-like object separating files and folders
 */
export async function categorizeTargets(targets: vscode.Uri[]) {
  const files: vscode.Uri[] = []
  const folders: vscode.Uri[] = []

  if (!targets.length) {
    return { files, folders }
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Processing selection...' },
    async () => {
      // Process in chunks to prevent "Too Many Open Files" (EMFILE) on huge selections
      for (let i = 0; i < targets.length; i += BATCH_SIZE_STAT) {
        const batch = targets.slice(i, i + BATCH_SIZE_STAT)
        await processStatBatch(batch, files, folders)
      }
    },
  )

  return { files, folders }
}

/**
 * Orchestrates recursive scanning of multiple folders with cancellation support.
 */
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
        vscode.window.showInformationMessage('Finished adding files from folders.')
      }
    },
  )
}

/**
 * Core Logic: Iterates through folders and performs glob matching.
 * Parallelized to maximize I/O throughput.
 */
export async function scanMultipleFolders(
  folders: vscode.Uri[],
  excludes: string,
  onFound: (files: vscode.Uri[]) => void,
  token?: vscode.CancellationToken,
): Promise<void> {
  // Process folders in small batches to avoid overloading the Search Service
  for (let i = 0; i < folders.length; i += BATCH_SIZE_GLOB) {
    if (token?.isCancellationRequested) break

    const batch = folders.slice(i, i + BATCH_SIZE_GLOB)
    await processScanBatch(batch, excludes, onFound, token)
  }
}

/**
 * Helper: Processes a batch of URIs for fs.stat calls
 */
async function processStatBatch(batch: vscode.Uri[], files: vscode.Uri[], folders: vscode.Uri[]): Promise<void> {
  await Promise.all(
    batch.map(async (target) => {
      try {
        const stat = await vscode.workspace.fs.stat(target)
        if (stat.type === vscode.FileType.File) files.push(target)
        if (stat.type === vscode.FileType.Directory) folders.push(target)
      } catch (error) {
        // Gracefully skip items we lack permissions for
        Logger.warn(`Skipping unreadable item: ${target.fsPath}`)
      }
    }),
  )
}

/**
 * Helper: Processes a batch of folders for glob scanning
 */
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

      // Critical: Guard against empty results to prevent unnecessary UI updates
      if (foundFiles.length > 0) {
        onFound(foundFiles)
      }
    }),
  )
}

/**
 * Performs glob search within a single directory root.
 */
async function scanFolder(
  folder: vscode.Uri,
  excludes: string,
  token?: vscode.CancellationToken,
): Promise<vscode.Uri[]> {
  try {
    const searchPattern = new vscode.RelativePattern(folder, '**/*')
    return await vscode.workspace.findFiles(searchPattern, excludes, undefined, token)
  } catch (err) {
    Logger.error(`Failed to scan folder: ${folder.fsPath}`, err)
    return []
  }
}
