import * as vscode from 'vscode'

/**
 * File content metrics for token estimation.
 */
export interface ContentStats {
  tokenCount: number
  charCount: number
}

/**
 * Represents a file in the context stack with metadata and processing state.
 */
export interface StagedFile {
  type: 'file'
  uri: vscode.Uri
  label: string
  stats?: ContentStats
  isBinary?: boolean
  isPinned?: boolean
}

/**
 * Represents a directory node in the context stack tree view.
 * Contains references to all leaf files to optimize recursive operations.
 */
export interface StagedFolder {
  type: 'folder'
  id: string
  label: string
  resourceUri: vscode.Uri
  children: StackTreeItem[]
  containedFiles: StagedFile[]
}

/**
 * Union type for items rendered in the Stack TreeView.
 */
export type StackTreeItem = StagedFile | StagedFolder

export function isStagedFolder(item: StackTreeItem): item is StagedFolder {
  return item.type === 'folder'
}

export function isStagedFile(item: StackTreeItem): item is StagedFile {
  return item.type === 'file'
}
