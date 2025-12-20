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

    return this.sortTree(rootItems)
  }

  /**
   * Recursively places a single file into the directory hierarchy.
   */
  private placeFileInTree(file: StagedFile, roots: StackTreeItem[], folderMap: Map<string, StagedFolder>) {
    const relativePath = vscode.workspace.asRelativePath(file.uri)
    const segments = relativePath.split('/')
    const isRootFile = segments.length === 1

    if (isRootFile) {
      roots.push(file)
      return
    }

    let currentPath = ''
    let parentChildren = roots

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      currentPath = currentPath ? `${currentPath}/${segment}` : segment

      let folder = folderMap.get(currentPath)
      if (!folder) {
        folder = this.createVirtualFolder(segment, currentPath, file.uri)
        folderMap.set(currentPath, folder)
        parentChildren.push(folder)
      }

      folder.containedFiles.push(file)
      parentChildren = folder.children
    }

    parentChildren.push(file)
  }

  private createVirtualFolder(name: string, id: string, sampleUri: vscode.Uri): StagedFolder {
    // Construct a URI for the folder based on the sample file's root
    const root = vscode.workspace.getWorkspaceFolder(sampleUri)
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

  private sortTree(items: StackTreeItem[]): StackTreeItem[] {
    return items.sort((a, b) => {
      // Folders first
      const aIsFolder = isStagedFolder(a)
      const bIsFolder = isStagedFolder(b)
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1

      // Then alphabetical
      return a.label.localeCompare(b.label)
    })
  }
}
