import * as vscode from 'vscode'

/**
 * Holds calculated metrics for a specific file.
 */
export interface ContentStats {
  /** Estimated token count based on LLM heuristics (e.g., 4 chars/token). */
  tokenCount: number
  /** Raw character count of the file content. */
  charCount: number
}

/**
 * Defines the structure for a file tracked in the context stack.
 * Includes optional stats which are calculated asynchronously after staging.
 */
export interface StagedFile {
  uri: vscode.Uri
  label: string
  /** * Statistics regarding the file content.
   * Undefined while the file is being processed asynchronously.
   */
  stats?: ContentStats
}
