import { TextDecoder } from 'util'
import * as vscode from 'vscode'

import { type ContentStats, type StagedFile } from '../models'
import { Logger, TokenEstimator } from '../utils'

/**
 * Service responsible for file I/O, binary detection, and token estimation.
 */
export class StatsProcessor {
  private readonly decoder = new TextDecoder()

  /**
   * measures content stats for a single file string.
   */
  public measure(content: string): ContentStats {
    const measurements = TokenEstimator.measure(content)
    return {
      tokenCount: measurements.tokenCount,
      charCount: content.length,
    }
  }

  /**
   * Enriches file metadata by reading content and calculating token estimates in parallel.
   */
  public async enrichFileStats(targets: StagedFile[]): Promise<void> {
    const filesToProcess = targets.filter((f) => !f.stats)

    if (filesToProcess.length === 0) return

    await Promise.all(
      filesToProcess.map(async (file) => {
        try {
          const uint8Array = await vscode.workspace.fs.readFile(file.uri)

          // Check first 512 bytes for null bytes (binary indicator)
          const isBinary = uint8Array.slice(0, 512).some((b) => b === 0)

          if (isBinary) {
            file.isBinary = true
            file.stats = { tokenCount: 0, charCount: 0 }
          } else {
            file.isBinary = false
            const content = this.decoder.decode(uint8Array)
            file.stats = this.measure(content)
          }
        } catch (error) {
          Logger.warn(`Failed to read stats for ${file.uri.fsPath}`)
        }
      }),
    )
  }
}
