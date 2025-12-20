import * as vscode from 'vscode'

/**
 * Holds calculated metrics for a specific file.
 */
export interface ContentStats {
  /** Estimated token count based on LLM heuristics. */
  tokenCount: number
  /** Raw character count of the file content. */
  charCount: number
}

/**
 * Defines the structure for a file tracked in the context stack.
 */
export interface StagedFile {
  uri: vscode.Uri
  label: string
  /**
   * Optional discriminator for duplicate filenames.
   * e.g., "auth" for "src/auth/index.ts" vs "api" for "src/api/index.ts".
   */
  parentHint?: string
  /**
   * Statistics regarding the file content.
   * Undefined while the file is being processed asynchronously.
   */
  stats?: ContentStats
  /**
   * Indicates if the file contains binary data (detected via null-byte check).
   */
  isBinary?: boolean
  /**
   * If true, this file persists during "Clear All" operations.
   */
  isPinned?: boolean
}
