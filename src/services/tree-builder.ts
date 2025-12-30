import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile, StagedFolder } from '../models'

export function getDescendantFiles(item: StackTreeItem): StagedFile[] {
  if (isStagedFolder(item)) {
    return item.children.flatMap((child) => getDescendantFiles(child))
  }
  return [item as StagedFile]
}

export class TreeBuilder {
  private folderMap = new Map<string, StagedFolder>()
  private rootItems: StackTreeItem[] = []
  private workspaceRoots: vscode.WorkspaceFolder[] = []
  private readonly YIELD_THRESHOLD = 250

  public async buildAsync(files: StagedFile[]): Promise<StackTreeItem[]> {
    this.resetState()

    let opCount = 0
    for (const file of files) {
      await this.processFile(file)
      opCount++
      if (opCount >= this.YIELD_THRESHOLD) {
        opCount = 0
        await new Promise((resolve) => setImmediate(resolve))
      }
    }

    return this.finalizeTree()
  }

  public async patch(
    currentTree: StackTreeItem[],
    addedFiles: StagedFile[],
    removedUriStrings: string[],
  ): Promise<StackTreeItem[]> {
    let tree = currentTree
    if (removedUriStrings.length > 0) {
      const removedSet = new Set(removedUriStrings)
      tree = this.pruneTree(tree, removedSet)
    }

    if (addedFiles.length > 0) {
      this.refreshWorkspaceRoots()
      for (const file of addedFiles) {
        if (!file.pathSegments) {
          file.pathSegments = this.computeSegments(file)
        }
        this.insertIntoTree(tree, file, file.pathSegments)
      }
    }

    await this.sortIterative(tree)
    this.calculateFolderStats(tree)

    return tree
  }

  public calculateFolderStats(items: StackTreeItem[]): number {
    let total = 0

    for (const item of items) {
      if (isStagedFolder(item)) {
        const folderTotal = this.calculateFolderStats(item.children)
        item.tokenCount = folderTotal
        total += folderTotal
      } else {
        total += item.stats?.tokenCount ?? 0
      }
    }

    return total
  }

  public computeSegments(file: StagedFile): string[] {
    if (this.workspaceRoots.length === 0) {
      this.refreshWorkspaceRoots()
    }
    const isMultiRoot = this.workspaceRoots.length > 1
    return vscode.workspace.asRelativePath(file.uri, isMultiRoot).split('/')
  }

  private resetState(): void {
    this.folderMap.clear()
    this.rootItems = []
    this.refreshWorkspaceRoots()
  }

  private refreshWorkspaceRoots(): void {
    this.workspaceRoots = vscode.workspace.workspaceFolders ? [...vscode.workspace.workspaceFolders] : []
  }

  private async processFile(file: StagedFile): Promise<void> {
    const segments = this.getOptimizedSegments(file)
    if (segments.length === 1) {
      this.rootItems.push(file)
      return
    }
    this.mapPathToTree(file, segments)
  }

  private mapPathToTree(file: StagedFile, segments: string[]): void {
    let parentChildren = this.rootItems
    let currentPath = ''

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      const folder = this.resolveFolder(segment, currentPath, file.uri, parentChildren)

      parentChildren = folder.children
      if (i === segments.length - 2) folder.containedFiles.push(file)
    }
    parentChildren.push(file)
  }

  private resolveFolder(name: string, id: string, refUri: vscode.Uri, list: StackTreeItem[]): StagedFolder {
    const existing = this.folderMap.get(id)
    if (existing) return existing

    const newFolder = this.createFolderNode(name, id, refUri)
    this.folderMap.set(id, newFolder)
    list.push(newFolder)
    return newFolder
  }

  private insertIntoTree(nodes: StackTreeItem[], file: StagedFile, segments: string[]): void {
    if (segments.length === 1) {
      nodes.push(file)
      return
    }

    let currentNodes = nodes
    let currentPath = ''

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      const folderId = `folder:${currentPath}`

      let folder = currentNodes.find(
        (n): n is StagedFolder => isStagedFolder(n) && (n.id === folderId || n.label === segment),
      )

      if (!folder) {
        folder = this.createFolderNode(segment, currentPath, file.uri)
        currentNodes.push(folder)
      }

      currentNodes = folder.children
      if (i === segments.length - 2) folder.containedFiles.push(file)
    }

    currentNodes.push(file)
  }

  private pruneTree(nodes: StackTreeItem[], removedSet: Set<string>): StackTreeItem[] {
    const kept: StackTreeItem[] = []

    for (const node of nodes) {
      if (isStagedFolder(node)) {
        node.children = this.pruneTree(node.children, removedSet)
        node.containedFiles = node.containedFiles.filter((f) => !removedSet.has(f.uri.toString()))

        if (node.children.length > 0) {
          kept.push(node)
        }
      } else {
        if (!removedSet.has(node.uri.toString())) {
          kept.push(node)
        }
      }
    }
    return kept
  }

  private createFolderNode(name: string, id: string, refUri: vscode.Uri): StagedFolder {
    const root = vscode.workspace.getWorkspaceFolder(refUri)
    const finalId = id.startsWith('folder:') ? id : `folder:${id}`
    return {
      type: 'folder',
      id: finalId,
      label: name,
      resourceUri: root ? vscode.Uri.joinPath(root.uri, id) : refUri,
      children: [],
      containedFiles: [],
      tokenCount: 0,
    }
  }

  private getOptimizedSegments(file: StagedFile): string[] {
    if (file.pathSegments) return file.pathSegments
    file.pathSegments = this.computeSegments(file)
    return file.pathSegments
  }

  private async finalizeTree(): Promise<StackTreeItem[]> {
    await this.sortIterative(this.rootItems)
    return this.rootItems
  }

  private async sortIterative(rootItems: StackTreeItem[]): Promise<void> {
    if (rootItems.length === 0) return

    rootItems.sort(this.sortComparator)

    const stack = [...rootItems]
    let opCount = 0

    while (stack.length > 0) {
      const item = stack.pop()

      opCount++
      if (opCount >= this.YIELD_THRESHOLD) {
        opCount = 0
        await new Promise((resolve) => setImmediate(resolve))
      }

      if (item && isStagedFolder(item) && item.children.length > 0) {
        item.children.sort(this.sortComparator)
        for (let i = item.children.length - 1; i >= 0; i--) {
          stack.push(item.children[i])
        }
      }
    }
  }

  private sortComparator(a: StackTreeItem, b: StackTreeItem): number {
    const aIsFolder = isStagedFolder(a)
    const bIsFolder = isStagedFolder(b)

    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1
    return a.label.localeCompare(b.label)
  }
}
