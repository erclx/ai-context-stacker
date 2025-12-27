import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile, StagedFolder } from '../models'

export class TreeBuilder {
  private folderMap = new Map<string, StagedFolder>()
  private rootItems: StackTreeItem[] = []
  private workspaceRoots: vscode.WorkspaceFolder[] = []

  public build(files: StagedFile[]): StackTreeItem[] {
    this.resetState()

    for (const file of files) {
      this.processFile(file)
    }

    return this.finalizeTree()
  }

  private resetState(): void {
    this.folderMap.clear()
    this.rootItems = []
    this.workspaceRoots = vscode.workspace.workspaceFolders ? [...vscode.workspace.workspaceFolders] : []
  }

  private processFile(file: StagedFile): void {
    const segments = this.getOptimizedSegments(file)

    if (segments.length === 1) {
      this.rootItems.push(file)
      return
    }

    this.mapPathToTree(file, segments)
  }

  private mapPathToTree(file: StagedFile, segments: string[]): void {
    let parentPath = ''
    let parentChildren = this.rootItems

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      const currentPath = parentPath ? `${parentPath}/${segment}` : segment

      const folder = this.ensureFolderExists(segment, currentPath, file.uri, parentChildren)

      parentChildren = folder.children
      parentPath = currentPath

      if (i === segments.length - 2) {
        folder.containedFiles.push(file)
      }
    }

    parentChildren.push(file)
  }

  private ensureFolderExists(name: string, id: string, refUri: vscode.Uri, targetList: StackTreeItem[]): StagedFolder {
    const existing = this.folderMap.get(id)
    if (existing) {
      return existing
    }

    const newFolder = this.createFolderNode(name, id, refUri)
    this.folderMap.set(id, newFolder)
    targetList.push(newFolder)

    return newFolder
  }

  private createFolderNode(name: string, id: string, refUri: vscode.Uri): StagedFolder {
    const root = vscode.workspace.getWorkspaceFolder(refUri)
    const resourceUri = root ? vscode.Uri.joinPath(root.uri, id) : refUri

    return {
      type: 'folder',
      id: `folder:${id}`,
      label: name,
      resourceUri,
      children: [],
      containedFiles: [],
    }
  }

  private getOptimizedSegments(file: StagedFile): string[] {
    if (this.workspaceRoots.length === 0) {
      return [file.label]
    }

    const isMultiRoot = this.workspaceRoots.length > 1
    return vscode.workspace.asRelativePath(file.uri, isMultiRoot).split('/')
  }

  private finalizeTree(): StackTreeItem[] {
    this.sortRecursive(this.rootItems)
    return this.rootItems
  }

  private sortRecursive(items: StackTreeItem[]): void {
    items.sort(this.sortComparator)

    for (const item of items) {
      if (isStagedFolder(item)) {
        this.sortRecursive(item.children)
      }
    }
  }

  private sortComparator(a: StackTreeItem, b: StackTreeItem): number {
    const aIsFolder = isStagedFolder(a)
    const bIsFolder = isStagedFolder(b)

    if (aIsFolder !== bIsFolder) {
      return aIsFolder ? -1 : 1
    }
    return a.label.localeCompare(b.label)
  }
}
