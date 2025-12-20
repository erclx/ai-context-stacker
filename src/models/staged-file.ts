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
  uri: vscode.Uri
  label: string
  stats?: ContentStats
  isBinary?: boolean
  isPinned?: boolean
}
