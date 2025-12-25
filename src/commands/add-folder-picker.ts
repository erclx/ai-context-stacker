import * as path from 'path'
import * as vscode from 'vscode'

import { IgnoreManager, StackProvider } from '../providers'
import { Logger } from '../utils'
import { scanMultipleFolders } from '../utils/file-scanner'

// Search limit to prevent performance bottlenecks on massive repos
const MAX_DISCOVERY_RESULTS = 5000

interface FolderQuickPickItem extends vscode.QuickPickItem {
  uri: vscode.Uri
}

export function registerAddFolderPickerCommand(
  context: vscode.ExtensionContext,
  stackProvider: StackProvider,
  ignoreManager: IgnoreManager,
): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addFolderPicker', async () => {
    await executeAddFolderPicker(stackProvider, ignoreManager)
  })

  context.subscriptions.push(command)
}

async function executeAddFolderPicker(provider: StackProvider, ignore: IgnoreManager): Promise<void> {
  try {
    const folders = await findUniqueFolders(ignore)

    if (folders.length === 0) {
      void vscode.window.showInformationMessage('No relevant folders found.')
      return
    }

    const selected = await showFolderPicker(folders)
    if (!selected?.length) return

    await processSelection(selected, provider, ignore)
  } catch (error) {
    Logger.error('Folder picker failed', error as Error)
    void vscode.window.showErrorMessage('Failed to add folders.')
  }
}

// --- Discovery Logic ---

async function findUniqueFolders(ignore: IgnoreManager): Promise<vscode.Uri[]> {
  const excludes = await ignore.getExcludePatterns()

  const [shallow, deep] = await Promise.all([discoverShallowFolders(), discoverDeepFolders(excludes)])

  return mergeFolderLists(shallow, deep)
}

async function discoverShallowFolders(): Promise<vscode.Uri[]> {
  const roots = vscode.workspace.workspaceFolders || []
  const results: vscode.Uri[] = []

  for (const root of roots) {
    results.push(root.uri)
    try {
      const children = await vscode.workspace.fs.readDirectory(root.uri)
      children.forEach(([name, type]) => {
        if (type === vscode.FileType.Directory) {
          results.push(vscode.Uri.joinPath(root.uri, name))
        }
      })
    } catch {
      /* Ignore permission errors */
    }
  }
  return results
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

// --- Processing Logic ---

async function processSelection(
  items: FolderQuickPickItem[],
  provider: StackProvider,
  ignore: IgnoreManager,
): Promise<void> {
  const distinctRoots = pruneNestedFolders(items.map((i) => i.uri))
  const excludes = await ignore.getExcludePatterns()

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Scanning ${distinctRoots.length} folder(s)...`,
      cancellable: true,
    },
    async (_, token) => {
      await scanMultipleFolders(distinctRoots, excludes, (files) => provider.addFiles(files), token)

      if (!token.isCancellationRequested) {
        void vscode.window.showInformationMessage(`Processed ${distinctRoots.length} folders.`)
      }
    },
  )
}

function pruneNestedFolders(uris: vscode.Uri[]): vscode.Uri[] {
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

function isChildOf(parent: vscode.Uri, child: vscode.Uri): boolean {
  const relative = path.relative(parent.fsPath, child.fsPath)
  return !relative.startsWith('..') && !path.isAbsolute(relative)
}

// --- UI Helpers ---

async function showFolderPicker(folders: vscode.Uri[]): Promise<FolderQuickPickItem[] | undefined> {
  const items = folders.map(createPickerItem)
  return vscode.window.showQuickPick(items, {
    canPickMany: true,
    placeHolder: 'Select folders to add...',
    matchOnDescription: true,
  })
}

function createPickerItem(uri: vscode.Uri): FolderQuickPickItem {
  const wsFolder = vscode.workspace.getWorkspaceFolder(uri)
  const isRoot = wsFolder ? uri.fsPath === wsFolder.uri.fsPath : false
  const name = path.basename(uri.fsPath)

  let description: string

  if (isRoot) {
    description = '(Workspace Root)'
  } else {
    const relative = vscode.workspace.asRelativePath(uri, false)

    description = relative === uri.fsPath ? '' : relative
  }

  return {
    label: isRoot ? `$(root-folder) ${wsFolder?.name ?? name}` : `$(folder) ${name}`,
    description,
    uri,
  }
}
