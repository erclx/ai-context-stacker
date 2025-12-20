import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { ContentFormatter } from './content-formatter'
import { Logger } from './logger'
import { TokenEstimator } from './token-estimator'

export class ClipboardOps {
  /**
   * Formats files, copies to clipboard, and notifies the user.
   * @param files - The list of files to process
   * @param label - UI label for the notification (e.g., "3 files")
   */
  public static async copy(files: StagedFile[], label: string): Promise<void> {
    const content = await ContentFormatter.format(files)

    if (!this._isValidContent(content)) {
      return
    }

    await vscode.env.clipboard.writeText(content)
    this._notifySuccess(content, label)
  }

  private static _isValidContent(content: string): boolean {
    if (!content) {
      vscode.window.showWarningMessage('Selected content is empty or binary.')
      return false
    }
    return true
  }

  private static _notifySuccess(content: string, label: string): void {
    const stats = TokenEstimator.measure(content)
    const statsString = TokenEstimator.format(stats)

    Logger.info(`Copied: ${label}`)
    vscode.window.showInformationMessage(`Copied ${label}! (${statsString})`)
  }
}
