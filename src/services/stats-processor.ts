import { TextDecoder } from 'util'
import * as vscode from 'vscode'

import { type ContentStats, type StagedFile } from '../models'
import { Logger, TokenEstimator } from '../utils'

/**
 * Service responsible for file I/O, binary detection, and token estimation.
 * Implements bounded concurrency to prevent EMFILE errors and memory exhaustion.
 */
export class StatsProcessor {
  private readonly decoder = new TextDecoder()

  // Prevent OS file handle exhaustion (EMFILE)
  private readonly CONCURRENCY_LIMIT = 5
  // Limit accurate token counting to 1MB to prevent OOM/Freezes
  private readonly MAX_ANALYSIS_SIZE = 1024 * 1024

  /**
   * Enriches file metadata by reading content and calculating token estimates.
   * Processes files in chunks to manage memory pressure.
   */
  public async enrichFileStats(targets: StagedFile[]): Promise<void> {
    const queue = targets.filter((f) => !f.stats)
    if (queue.length === 0) return

    // Chunk processing allows GC to clean up buffers between batches
    for (let i = 0; i < queue.length; i += this.CONCURRENCY_LIMIT) {
      const chunk = queue.slice(i, i + this.CONCURRENCY_LIMIT)
      await Promise.all(chunk.map((file) => this.processFile(file)))
    }
  }

  /**
   * Error boundary wrapper for individual file processing.
   * Ensures one failure does not halt the entire batch.
   */
  private async processFile(file: StagedFile): Promise<void> {
    try {
      await this.dispatchAnalysis(file)
    } catch (error) {
      Logger.warn(`Failed to read stats for ${file.uri.fsPath}`)
      this.setEmptyStats(file)
    }
  }

  /**
   * Routes logic based on file size to avoid reading large files into memory.
   */
  private async dispatchAnalysis(file: StagedFile): Promise<void> {
    const size = await this.getFileSize(file.uri)

    if (size > this.MAX_ANALYSIS_SIZE) {
      this.applyHeuristicStats(file, size)
    } else {
      await this.analyzeSmallFile(file, size)
    }
  }

  /**
   * Reads content, detects binary, and measures tokens for safe-sized files.
   */
  private async analyzeSmallFile(file: StagedFile, size: number): Promise<void> {
    const content = await this.readTextContent(file.uri)

    if (content === null) {
      file.isBinary = true
      this.setEmptyStats(file)
      return
    }

    file.isBinary = false
    file.stats = this.measure(content)
  }

  /**
   * Applies rough estimates for large files to avoid I/O blocking.
   */
  private applyHeuristicStats(file: StagedFile, size: number): void {
    file.isBinary = false // Assume text if unchecked to allow context selection warning later
    file.stats = {
      tokenCount: Math.ceil(size / 4), // Rough estimate: 4 chars per token
      charCount: size,
    }
  }

  public measure(content: string): ContentStats {
    const measurements = TokenEstimator.measure(content)
    return {
      tokenCount: measurements.tokenCount,
      charCount: content.length,
    }
  }

  private setEmptyStats(file: StagedFile): void {
    file.stats = { tokenCount: 0, charCount: 0 }
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
    const checkLength = Math.min(uint8Array.length, 512)
    const isBinary = uint8Array.slice(0, checkLength).some((b) => b === 0)

    if (isBinary) return null
    return this.decoder.decode(uint8Array)
  }
}
