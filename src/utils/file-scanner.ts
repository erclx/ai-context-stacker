import * as os from 'os'
import * as path from 'path'
import * as vscode from 'vscode'

import { IgnoreManager, StackProvider } from '../providers'
import { Logger } from './logger'

export const BATCH_SIZE_STAT = 50
const CONCURRENCY_LIMIT = Math.max(2, os.cpus().length)
const MAX_DISCOVERY_RESULTS = 5000

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
        await new Promise((resolve) => setImmediate(resolve))
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
  const chunkSize = CONCURRENCY_LIMIT

  for (let i = 0; i < folders.length; i += chunkSize) {
    if (token?.isCancellationRequested) break

    const batch = folders.slice(i, i + chunkSize)

    await Promise.all(
      batch.map(async (folder) => {
        if (token?.isCancellationRequested) return
        const foundFiles = await scanFolder(folder, excludes, token)
        if (foundFiles.length > 0) onFound(foundFiles)
      }),
    )

    await new Promise((resolve) => setImmediate(resolve))
  }
}

export async function discoverWorkspaceFolders(ignore: IgnoreManager): Promise<vscode.Uri[]> {
  const excludes = await ignore.getExcludePatterns()
  const [shallow, deep] = await Promise.all([discoverShallowFolders(), discoverDeepFolders(excludes)])

  return mergeFolderLists(shallow, deep)
}

export function pruneNestedFolders(uris: vscode.Uri[]): vscode.Uri[] {
  const sorted = [...uris].sort((a, b) => a.fsPath.length - b.fsPath.length)
  const accepted: vscode.Uri[] = []

  for (const uri of sorted) {
    const isNested = accepted.some((parent) => isChildOf(parent, uri))
    if (!isNested) {
      accepted.push(uri)
    }
  }
  return accepted
}

export function isChildOf(parent: vscode.Uri, child: vscode.Uri): boolean {
  const relative = path.relative(parent.fsPath, child.fsPath)
  return !relative.startsWith('..') && !path.isAbsolute(relative)
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

async function discoverShallowFolders(): Promise<vscode.Uri[]> {
  const roots = vscode.workspace.workspaceFolders || []
  const results: vscode.Uri[] = []

  for (const root of roots) {
    results.push(root.uri)
    await safeReadDirectory(root.uri, results)
  }
  return results
}

async function safeReadDirectory(rootUri: vscode.Uri, results: vscode.Uri[]): Promise<void> {
  try {
    const children = await vscode.workspace.fs.readDirectory(rootUri)
    children.forEach(([name, type]) => {
      if (type === vscode.FileType.Directory) {
        results.push(vscode.Uri.joinPath(rootUri, name))
      }
    })
  } catch {
    // Suppress errors for inaccessible directories
  }
}

async function discoverDeepFolders(excludes: string): Promise<vscode.Uri[]> {
  const files = await vscode.workspace.findFiles('**/*', excludes, MAX_DISCOVERY_RESULTS)
  return files.map((f) => vscode.Uri.file(path.dirname(f.fsPath)))
}

function mergeFolderLists(listA: vscode.Uri[], listB: vscode.Uri[]): vscode.Uri[] {
  const unique = new Map<string, vscode.Uri>()
  const add = (uri: vscode.Uri) => unique.set(uri.fsPath, uri)

  listA.forEach(add)
  listB.forEach(add)

  return Array.from(unique.values()).sort((a, b) => a.fsPath.localeCompare(b.fsPath))
}
