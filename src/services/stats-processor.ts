import { TextDecoder } from 'util'
import * as vscode from 'vscode'

import { ContentStats, StagedFile } from '../models'
import { Logger, TokenEstimator } from '../utils'

export class StatsProcessor {
  private readonly decoder = new TextDecoder()
  private readonly STARTUP_DELAY_MS = 2500
  private readonly MAX_BATCH_SIZE = 50

  private startupPromise: Promise<void>

  constructor() {
    this.startupPromise = new Promise((resolve) => {
      setTimeout(resolve, this.STARTUP_DELAY_MS)
    })
  }

  public async enrichFileStats(targets: StagedFile[]): Promise<void> {
    await this.startupPromise

    const queue = targets.filter((f) => !f.stats)
    if (queue.length === 0) return

    for (let i = 0; i < queue.length; i += this.MAX_BATCH_SIZE) {
      const batch = queue.slice(i, i + this.MAX_BATCH_SIZE)
      await this.processBatch(batch)
      await this.yieldToEventLoop()
    }
  }

  public measure(content: string): ContentStats {
    const measurements = TokenEstimator.measure(content)
    return {
      tokenCount: measurements.tokenCount,
      charCount: content.length,
    }
  }

  private async processBatch(batch: StagedFile[]): Promise<void> {
    const promises = batch.map((file) => this.processFile(file))
    await Promise.all(promises)
  }

  private async processFile(file: StagedFile): Promise<void> {
    try {
      const size = await this.getFileSize(file.uri)

      if (size > 1024 * 1024) {
        this.applyHeuristicStats(file, size)
      } else {
        await this.analyzeExactStats(file)
      }
    } catch (error) {
      Logger.warn(`Stats read failed: ${file.uri.fsPath}`)
      this.setEmptyStats(file)
    }
  }

  private async analyzeExactStats(file: StagedFile): Promise<void> {
    const content = await this.readTextContent(file.uri)

    if (content === null) {
      file.isBinary = true
      this.setEmptyStats(file)
      return
    }

    file.isBinary = false
    file.stats = this.measure(content)
  }

  private applyHeuristicStats(file: StagedFile, size: number): void {
    file.isBinary = false
    file.stats = {
      tokenCount: Math.ceil(size / 4),
      charCount: size,
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

  private async readTextContent(uri: vscode.Uri): Promise<string | null> {
    const buffer = await vscode.workspace.fs.readFile(uri)

    const checkLen = Math.min(buffer.length, 512)
    for (let i = 0; i < checkLen; i++) {
      if (buffer[i] === 0) return null
    }

    return this.decoder.decode(buffer)
  }

  private yieldToEventLoop(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0))
  }
}
