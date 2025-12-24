import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { ContentFormatter } from './content-formatter'
import { Logger } from './logger'
import { TokenEstimator } from './token-estimator'

export class ClipboardOps {
  /**
   * Formats files and copies them to the clipboard.
   * Wraps the raw text copier.
   * @param files - The list of files to process
   * @param label - UI label (e.g., "3 files")
   */
  public static async copy(files: StagedFile[], label: string): Promise<void> {
    const content = await ContentFormatter.format(files)
    await this.copyText(content, label)
  }

  /**
   * Copies raw text to clipboard and triggers standard notifications.
   * Useful for Webviews or pre-formatted content.
   * @param content - The raw string to copy
   * @param label - UI label (e.g., "Preview Content")
   */
  public static async copyText(content: string, label: string): Promise<void> {
    if (!this._isValidContent(content)) {
      return
    }

    try {
      await vscode.env.clipboard.writeText(content)
      this._notifySuccess(content, label)
    } catch (error) {
      Logger.error('Clipboard write failed', error)
      void vscode.window.showErrorMessage('Failed to write to clipboard.')
    }
  }

  private static _isValidContent(content: string): boolean {
    if (!content) {
      void vscode.window.showWarningMessage('Selected content is empty.')
      return false
    }
    return true
  }

  private static _notifySuccess(content: string, label: string): void {
    const stats = TokenEstimator.measure(content)
    const statsString = TokenEstimator.format(stats)

    Logger.info(`Copied: ${label}`)
    void vscode.window.showInformationMessage(`Copied ${label}! (${statsString})`)
  }
}
