import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { ContentFormatter } from './content-formatter'
import { Logger } from './logger'
import { TokenEstimator } from './token-estimator'

export class ClipboardOps {
  public static async copy(files: StagedFile[], label: string): Promise<void> {
    const content = await ContentFormatter.format(files)
    await this.copyText(content, label)
  }

  public static async copyText(content: string, label: string): Promise<void> {
    if (!this.validatePayload(content)) return

    try {
      if (!vscode.env.clipboard) {
        throw new Error('Clipboard API unavailable in this environment')
      }

      await vscode.env.clipboard.writeText(content)
      this.broadcastSuccess(content, label)
    } catch (error) {
      Logger.error('Clipboard write failed', error)
      void vscode.window.showErrorMessage('Failed to write to clipboard. See output for details.')
    }
  }

  private static validatePayload(content: string): boolean {
    if (!content || content.trim().length === 0) {
      void vscode.window.showWarningMessage('Selected content is empty.')
      return false
    }
    return true
  }

  private static broadcastSuccess(content: string, label: string): void {
    const stats = TokenEstimator.measure(content)
    const statsString = TokenEstimator.format(stats)

    Logger.info(`Copied: ${label}`)
    void vscode.window.showInformationMessage(`Copied ${label}! (${statsString})`)
  }
}
