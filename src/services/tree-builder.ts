import * as vscode from 'vscode'

import { ContentStats, getSortWeight, isStagedFolder, StackTreeItem, StagedFile, StagedFolder } from '../models'

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
  private readonly collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  private readonly CHUNK_SIZE = 500

  public reset(): void {
    this.folderMap.clear()
    this.rootItems = []
    this.refreshWorkspaceRoots()
  }

  public async buildAsync(files: StagedFile[]): Promise<StackTreeItem[]> {
    this.reset()
    await this.processFileBatch(files)
    this.recalculateAllStats()
    this.propagatePinState(this.rootItems)
    this.sortRecursive(this.rootItems)
    return this.rootItems
  }

  public async patch(added: StagedFile[], removed: StagedFile[]): Promise<StackTreeItem[]> {
    this.ensureWorkspaceRoots()
    this.processRemovals(removed)
    this.processAdditions(added)
    this.propagatePinState(this.rootItems)
    this.sortRecursive(this.rootItems)
    return this.rootItems
  }

  public resort(): void {
    this.propagatePinState(this.rootItems)
    this.sortRecursive(this.rootItems)
  }

  public updateFileStats(
    file: StagedFile,
    oldStats: ContentStats | undefined,
    newStats: ContentStats | undefined,
  ): void {
    const delta = (newStats?.tokenCount ?? 0) - (oldStats?.tokenCount ?? 0)
    if (delta === 0) return

    const segments = this.getOptimizedSegments(file)
    this.propagateStatChange(segments, delta)
  }

  public recalculateAllStats(): void {
    this.calculateNodeStats(this.rootItems)
  }

  private async processFileBatch(files: StagedFile[]): Promise<void> {
    for (let i = 0; i < files.length; i += this.CHUNK_SIZE) {
      const chunk = files.slice(i, i + this.CHUNK_SIZE)
      chunk.forEach((file) => this.insertFile(file))
      if (files.length > this.CHUNK_SIZE) {
        await this.yieldToEventLoop()
      }
    }
  }

  private async yieldToEventLoop(): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve))
  }

  private processRemovals(removed: StagedFile[]): void {
    removed.forEach((file) => this.removeFile(file))
  }

  private processAdditions(added: StagedFile[]): void {
    added.forEach((file) => this.insertFile(file))
  }

  private ensureWorkspaceRoots(): void {
    if (this.workspaceRoots.length === 0) {
      this.refreshWorkspaceRoots()
    }
  }

  private calculateNodeStats(nodes: StackTreeItem[]): number {
    let total = 0
    for (const node of nodes) {
      if (isStagedFolder(node)) {
        node.tokenCount = this.calculateNodeStats(node.children)
        total += node.tokenCount
      } else {
        total += node.stats?.tokenCount ?? 0
      }
    }
    return total
  }

  private propagateStatChange(segments: string[], delta: number): void {
    let currentPath = ''
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      const folder = this.folderMap.get(`folder:${currentPath}`)
      if (folder) {
        folder.tokenCount = (folder.tokenCount ?? 0) + delta
      }
    }
  }

  private insertFile(file: StagedFile): void {
    const segments = this.getOptimizedSegments(file)
    if (segments.length === 1) {
      this.rootItems.push(file)
      this.applyInitialStats(file)
      return
    }
    this.insertNestedFile(file, segments)
  }

  private insertNestedFile(file: StagedFile, segments: string[]): void {
    let currentPath = ''
    let parentChildren = this.rootItems

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      currentPath = currentPath ? `${currentPath}/${segment}` : segment

      const folder = this.resolveOrCreateFolder(segment, currentPath, file.uri, parentChildren)
      parentChildren = folder.children

      this.trackContainedFile(folder, file, i, segments.length)
    }

    parentChildren.push(file)
    this.applyInitialStats(file)
  }

  private resolveOrCreateFolder(
    segment: string,
    currentPath: string,
    refUri: vscode.Uri,
    parentList: StackTreeItem[],
  ): StagedFolder {
    const folderId = `folder:${currentPath}`
    let folder = this.folderMap.get(folderId)

    if (!folder) {
      folder = this.createFolderNode(segment, currentPath, refUri)
      this.folderMap.set(folderId, folder)
      parentList.push(folder)
    }
    return folder
  }

  private trackContainedFile(folder: StagedFolder, file: StagedFile, index: number, totalSegments: number): void {
    if (index === totalSegments - 2) {
      if (!folder.containedFiles.includes(file)) {
        folder.containedFiles.push(file)
      }
    }
  }

  private applyInitialStats(file: StagedFile): void {
    if (file.stats?.tokenCount) {
      this.updateFileStats(file, undefined, file.stats)
    }
  }

  private removeFile(file: StagedFile): void {
    if (file.stats?.tokenCount) {
      this.updateFileStats(file, file.stats, undefined)
    }

    const segments = this.getOptimizedSegments(file)
    if (segments.length === 1) {
      this.rootItems = this.rootItems.filter((i) => i !== file)
      return
    }

    this.removeNestedFile(file, segments)
  }

  private removeNestedFile(file: StagedFile, segments: string[]): void {
    const parents = this.resolveParentHierarchy(segments)
    if (parents.length === 0) return

    const directParent = parents[parents.length - 1]
    this.detachFileFromParent(directParent, file)
    this.pruneEmptyFolders(parents)
  }

  private resolveParentHierarchy(segments: string[]): StagedFolder[] {
    let currentPath = ''
    const parents: StagedFolder[] = []

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      const folder = this.folderMap.get(`folder:${currentPath}`)
      if (!folder) return []
      parents.push(folder)
    }
    return parents
  }

  private detachFileFromParent(parent: StagedFolder, file: StagedFile): void {
    parent.children = parent.children.filter((c) => c !== file)
    parent.containedFiles = parent.containedFiles.filter((f) => f !== file)
  }

  private pruneEmptyFolders(parents: StagedFolder[]): void {
    for (let i = parents.length - 1; i >= 0; i--) {
      const folder = parents[i]
      if (folder.children.length > 0) break

      this.folderMap.delete(folder.id)
      this.detachFolder(folder, i, parents)
    }
  }

  private detachFolder(folder: StagedFolder, index: number, parents: StagedFolder[]): void {
    if (index === 0) {
      this.rootItems = this.rootItems.filter((item) => item !== folder)
    } else {
      const parent = parents[index - 1]
      parent.children = parent.children.filter((c) => c !== folder)
    }
  }

  private getOptimizedSegments(file: StagedFile): string[] {
    if (!file.pathSegments) {
      const isMultiRoot = this.workspaceRoots.length > 1
      file.pathSegments = vscode.workspace.asRelativePath(file.uri, isMultiRoot).split('/')
    }
    return file.pathSegments
  }

  private createFolderNode(name: string, relativePath: string, refUri: vscode.Uri): StagedFolder {
    const root = vscode.workspace.getWorkspaceFolder(refUri)
    const resourceUri = root ? vscode.Uri.joinPath(root.uri, relativePath) : refUri

    return {
      type: 'folder',
      id: `folder:${relativePath}`,
      label: name,
      resourceUri,
      children: [],
      containedFiles: [],
      tokenCount: 0,
    }
  }

  private refreshWorkspaceRoots(): void {
    this.workspaceRoots = vscode.workspace.workspaceFolders ? [...vscode.workspace.workspaceFolders] : []
  }

  private sortRecursive(nodes: StackTreeItem[]): void {
    if (nodes.length === 0) return

    nodes.sort((a, b) => this.compareNodes(a, b))

    for (const node of nodes) {
      if (isStagedFolder(node)) {
        this.sortRecursive(node.children)
      }
    }
  }

  private compareNodes(a: StackTreeItem, b: StackTreeItem): number {
    const weightA = getSortWeight(a)
    const weightB = getSortWeight(b)

    if (weightA !== weightB) {
      return weightB - weightA
    }
    return this.collator.compare(a.label, b.label)
  }

  private propagatePinState(nodes: StackTreeItem[]): boolean {
    let hasPinned = false
    for (const node of nodes) {
      if (isStagedFolder(node)) {
        const childrenPinned = this.propagatePinState(node.children)
        node.isPinned = childrenPinned
        if (childrenPinned) hasPinned = true
      } else {
        if (node.isPinned) hasPinned = true
      }
    }
    return hasPinned
  }
}
