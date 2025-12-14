import * as vscode from 'vscode'

export interface StagedFile {
  uri: vscode.Uri
  label: string
}
