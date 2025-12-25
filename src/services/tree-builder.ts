import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile, StagedFolder } from '../models'

/**
 * Service responsible for constructing the hierarchical view model from flat file lists.
 */
export class TreeBuilder {
  /**
   * Transforms a flat list of StagedFiles into a hierarchical tree based on relative paths.
   */
  public build(files: StagedFile[]): StackTreeItem[] {
    const rootItems: StackTreeItem[] = []
    const folderMap = new Map<string, StagedFolder>()

    for (const file of files) {
      this.placeFileInTree(file, rootItems, folderMap)
    }

    return this.sortTreeRecursive(rootItems)
  }

  /**
   * Recursively places a single file into the directory hierarchy.
   */
  private placeFileInTree(file: StagedFile, roots: StackTreeItem[], folderMap: Map<string, StagedFolder>): void {
    const segments = this.getPathSegments(file)

    if (segments.length === 1) {
      roots.push(file)
      return
    }

    this.traverseAndPlace(file, segments, roots, folderMap)
  }

  private traverseAndPlace(
    file: StagedFile,
    segments: string[],
    roots: StackTreeItem[],
    folderMap: Map<string, StagedFolder>,
  ): void {
    let currentPath = ''
    let parentChildren = roots

    // Iterate over folder segments only (exclude the filename)
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      currentPath = currentPath ? `${currentPath}/${segment}` : segment

      const folder = this.getOrCreateFolder(segment, currentPath, file.uri, folderMap, parentChildren)

      folder.containedFiles.push(file)
      parentChildren = folder.children
    }

    parentChildren.push(file)
  }

  /**
   * Retrieves an existing folder or creates/registers a new one.
   */
  private getOrCreateFolder(
    name: string,
    pathId: string,
    sampleUri: vscode.Uri,
    map: Map<string, StagedFolder>,
    parentList: StackTreeItem[],
  ): StagedFolder {
    let folder = map.get(pathId)

    if (!folder) {
      folder = this.createVirtualFolder(name, pathId, sampleUri)
      map.set(pathId, folder)
      parentList.push(folder)
    }

    return folder
  }

  private getPathSegments(file: StagedFile): string[] {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(file.uri)

    // If file is outside workspace, treat it as a flat file to avoid path errors
    if (!workspaceFolder) {
      return [file.label]
    }

    return vscode.workspace.asRelativePath(file.uri, false).split('/')
  }

  private createVirtualFolder(name: string, id: string, sampleUri: vscode.Uri): StagedFolder {
    const root = vscode.workspace.getWorkspaceFolder(sampleUri)
    // Reconstruct valid URI for the folder so context menus work
    const folderUri = root ? vscode.Uri.joinPath(root.uri, id) : sampleUri

    return {
      type: 'folder',
      id: `folder:${id}`,
      label: name,
      resourceUri: folderUri,
      children: [],
      containedFiles: [],
    }
  }

  private sortTreeRecursive(items: StackTreeItem[]): StackTreeItem[] {
    items.sort((a, b) => {
      const aIsFolder = isStagedFolder(a)
      const bIsFolder = isStagedFolder(b)

      if (aIsFolder !== bIsFolder) {
        return aIsFolder ? -1 : 1
      }
      return a.label.localeCompare(b.label)
    })

    // Deep sort children
    for (const item of items) {
      if (isStagedFolder(item)) {
        this.sortTreeRecursive(item.children)
      }
    }

    return items
  }
}
