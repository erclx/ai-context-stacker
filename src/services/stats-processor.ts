import { TextDecoder } from 'util'
import * as vscode from 'vscode'

import { type ContentStats, type StagedFile } from '../models'
import { Logger, TokenEstimator } from '../utils'

/**
 * Service responsible for file I/O, binary detection, and token estimation.
 */
export class StatsProcessor {
  private readonly decoder = new TextDecoder()
  // Limit accurate token counting to 1MB to prevent OOM/Freezes
  private readonly MAX_ANALYSIS_SIZE = 1024 * 1024

  /**
   * Enriches file metadata by reading content and calculating token estimates in parallel.
   */
  public async enrichFileStats(targets: StagedFile[]): Promise<void> {
    const filesToProcess = targets.filter((f) => !f.stats)

    if (filesToProcess.length === 0) return

    await Promise.all(filesToProcess.map((file) => this.processFile(file)))
  }

  /**
   * Processes a single file: reads content, checks binary status, and assigns stats.
   */
  private async processFile(file: StagedFile): Promise<void> {
    try {
      const fileSize = await this.getFileSize(file.uri)

      // optimization: Fast heuristic for large files without reading content
      if (fileSize > this.MAX_ANALYSIS_SIZE) {
        file.isBinary = false // Assume text if we can't check, or handle as special case
        file.stats = {
          tokenCount: Math.ceil(fileSize / 4), // Rough estimate
          charCount: fileSize,
        }
        return
      }

      const content = await this.readTextContent(file.uri)

      if (content === null) {
        file.isBinary = true
        file.stats = { tokenCount: 0, charCount: 0 }
      } else {
        file.isBinary = false
        file.stats = this.measure(content)
      }
    } catch (error) {
      Logger.warn(`Failed to read stats for ${file.uri.fsPath}`)
      // Set zero stats on error to prevent infinite retry loops
      file.stats = { tokenCount: 0, charCount: 0 }
    }
  }

  /**
   * Measures content stats for a single file string.
   */
  public measure(content: string): ContentStats {
    const measurements = TokenEstimator.measure(content)
    return {
      tokenCount: measurements.tokenCount,
      charCount: content.length,
    }
  }

  private async getFileSize(uri: vscode.Uri): Promise<number> {
    try {
      const stat = await vscode.workspace.fs.stat(uri)
      return stat.size
    } catch {
      return 0
    }
  }

  /**
   * Reads file content, handling binary detection.
   * @returns The string content if text, or null if binary.
   */
  private async readTextContent(uri: vscode.Uri): Promise<string | null> {
    const uint8Array = await vscode.workspace.fs.readFile(uri)

    // Check first 512 bytes for null bytes (binary indicator)
    const isBinary = uint8Array.slice(0, 512).some((b) => b === 0)

    if (isBinary) {
      return null
    }

    return this.decoder.decode(uint8Array)
  }
}
