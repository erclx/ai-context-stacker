import { TextDecoder } from 'util'
import * as vscode from 'vscode'

import { ContentStats, StagedFile } from '../models'
import { Logger, TokenEstimator } from '../utils'

/**
 * Handles bulk analysis of file metadata and token counts.
 * Implements a tiered batching strategy to process large file sets without
 * blocking the VS Code extension host or exhausting the V8 heap.
 */
export class StatsProcessor {
  private readonly decoder = new TextDecoder()
  private readonly CONCURRENCY_LIMIT = 5
  private readonly MAX_ANALYSIS_SIZE = 1024 * 1024
  private readonly MAX_BATCH_SIZE = 100

  /**
   * Primary entry point for calculating statistics for a list of staged files.
   * Processes files in batches to allow for Garbage Collection between cycles.
   * @param targets - Array of files requiring stats enrichment
   */
  public async enrichFileStats(targets: StagedFile[]): Promise<void> {
    const queue = targets.filter((f) => !f.stats)
    if (queue.length === 0) return

    for (let batchStart = 0; batchStart < queue.length; batchStart += this.MAX_BATCH_SIZE) {
      const batch = queue.slice(batchStart, batchStart + this.MAX_BATCH_SIZE)

      // Process batch using controlled concurrency to avoid OS file handle limits
      for (let i = 0; i < batch.length; i += this.CONCURRENCY_LIMIT) {
        const chunk = batch.slice(i, i + this.CONCURRENCY_LIMIT)
        await Promise.all(chunk.map((file) => this.processFile(file)))
      }

      // Prevent event loop starvation during massive directory scans
      await this.yieldToEventLoop()
    }
  }

  /**
   * Orchestrates the analysis of a single file with error boundaries.
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
   * Determines analysis strategy based on file size.
   */
  private async dispatchAnalysis(file: StagedFile): Promise<void> {
    const size = await this.getFileSize(file.uri)

    // Use fast heuristics for large files to avoid reading massive buffers into memory
    if (size > this.MAX_ANALYSIS_SIZE) {
      this.applyHeuristicStats(file, size)
    } else {
      await this.analyzeSmallFile(file, size)
    }
  }

  /**
   * Performs deep content analysis on files within the memory safety threshold.
   */
  private async analyzeSmallFile(file: StagedFile, size: number): Promise<void> {
    const content = await this.readTextContent(file.uri)

    // Release control to UI thread after I/O pressure
    await this.yieldToEventLoop()

    if (content === null) {
      file.isBinary = true
      this.setEmptyStats(file)
      return
    }

    file.isBinary = false
    file.stats = this.measure(content)
  }

  /**
   * Fallback estimation for large files where exact tokenization is expensive.
   */
  private applyHeuristicStats(file: StagedFile, size: number): void {
    file.isBinary = false
    file.stats = {
      // Standard heuristic: 1 token is roughly 4 characters
      tokenCount: Math.ceil(size / 4),
      charCount: size,
    }
  }

  /**
   * Calculates token density and character count for a given string.
   */
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

  /**
   * Wraps VS Code FileSystem API with safety logging.
   */
  private async getFileSize(uri: vscode.Uri): Promise<number> {
    try {
      const stat = await vscode.workspace.fs.stat(uri)
      return stat.size
    } catch (e) {
      Logger.error(`FS Stat failed: ${uri.fsPath}`, e)
      return 0
    }
  }

  /**
   * Reads file content with a null-byte check to identify binary files.
   * @returns String content or null if the file appears to be binary.
   */
  private async readTextContent(uri: vscode.Uri): Promise<string | null> {
    const uint8Array = await vscode.workspace.fs.readFile(uri)

    // Check first 512 bytes for null characters (standard heuristic for binary detection)
    const checkLength = Math.min(uint8Array.length, 512)
    const isBinary = uint8Array.slice(0, checkLength).some((b) => b === 0)

    if (isBinary) return null
    return this.decoder.decode(uint8Array)
  }

  /**
   * Manual yield to the Node.js event loop to keep the VS Code UI responsive
   * during intensive CPU tasks (like token estimation).
   */
  private yieldToEventLoop(): Promise<void> {
    return new Promise((resolve) => {
      // setImmediate is preferred in Node for faster resumption than setTimeout
      if (typeof setImmediate === 'function') {
        setImmediate(resolve)
      } else {
        setTimeout(resolve, 0)
      }
    })
  }
}
