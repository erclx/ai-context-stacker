import { TextDecoder } from 'util'
import * as vscode from 'vscode'

import { ContentStats, StagedFile } from '../models'
import { Logger, TokenEstimator } from '../utils'

export class StatsProcessor {
  private readonly decoder = new TextDecoder()
  private readonly STARTUP_DELAY_MS = 2500

  private startupPromise: Promise<void>
  private _onDidWarmup = new vscode.EventEmitter<void>()
  public readonly onDidWarmup = this._onDidWarmup.event

  constructor() {
    this.startupPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve()
        this._onDidWarmup.fire()
      }, this.STARTUP_DELAY_MS)
    })
  }

  public async enrichFileStats(targets: StagedFile[]): Promise<void> {
    await this.startupPromise

    const queue = targets.filter((f) => !f.stats)
    if (queue.length === 0) return

    await this.processQueue(queue)
  }

  public measure(content: string): ContentStats {
    const measurements = TokenEstimator.measure(content)
    return {
      tokenCount: measurements.tokenCount,
      charCount: content.length,
    }
  }

  private async processQueue(queue: StagedFile[]): Promise<void> {
    for (const file of queue) {
      await this.processFile(file)
      await this.yieldToEventLoop()
    }
  }

  private async processFile(file: StagedFile): Promise<void> {
    try {
      const size = await this.getFileSize(file.uri)
      if (size > 1024 * 1024) {
        this.applyHeuristicStats(file, size)
        return
      }
      await this.analyzeExactStats(file)
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
    if (this.isBinaryBuffer(buffer)) return null
    return this.decoder.decode(buffer)
  }

  private isBinaryBuffer(buffer: Uint8Array): boolean {
    const checkLen = Math.min(buffer.length, 512)
    for (let i = 0; i < checkLen; i++) {
      if (buffer[i] === 0) return true
    }
    return false
  }

  private yieldToEventLoop(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 5))
  }
}
