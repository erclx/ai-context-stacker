import * as vscode from 'vscode'

/**
 * Defines the minimal structure for a file tracked in the context stack.
 * This object is used for both internal state and the TreeView representation.
 */
export interface StagedFile {
  uri: vscode.Uri
  label: string // The display name (usually the filename)
}
