import * as os from 'os'
import * as path from 'path'
import { TextDecoder } from 'util'
import * as vscode from 'vscode'

import { KNOWN_BINARY_EXTENSIONS, KNOWN_TEXT_EXTENSIONS } from '../constants'
import { ContentStats, StagedFile } from '../models'
import { Logger, TokenEstimator } from '../utils'

interface CachedFileStats {
  mtime: number
  size: number
  stats: ContentStats
}

interface StatsCache {
  [fileUri: string]: CachedFileStats
}

export class StatsProcessor implements vscode.Disposable {
  private readonly decoder = new TextDecoder()
  private static readonly CACHE_KEY = 'aiContextStacker.statsCache.v1'
  private static readonly CACHE_LIMIT_ENTRIES = 1000

  private _isDisposed = false

  private statsCache: StatsCache = {}
  private cacheHits = 0
  private cacheMisses = 0

  constructor(private context?: vscode.ExtensionContext) {
    this.loadCache()
  }

  public dispose(): void {
    this._isDisposed = true
    void this.saveCache()
  }

  private get concurrencyLimit(): number {
    const cpus = os.cpus().length
    return Math.min(Math.max(2, cpus * 2), 20)
  }

  private loadCache(): void {
    if (!this.context) return

    try {
      const cached = this.context.workspaceState.get<StatsCache>(StatsProcessor.CACHE_KEY)
      if (cached) {
        this.statsCache = cached
        const cacheSize = Object.keys(cached).length
        Logger.debug(`Loaded stats cache with ${cacheSize} entries`)
      }
    } catch (error) {
      Logger.error('Failed to load stats cache', error as Error)
      this.statsCache = {}
    }
  }

  private async saveCache(): Promise<void> {
    if (!this.context || this._isDisposed) return

    try {
      const entries = Object.entries(this.statsCache)
      if (entries.length > StatsProcessor.CACHE_LIMIT_ENTRIES) {
        entries.sort((a, b) => b[1].mtime - a[1].mtime)
        this.statsCache = Object.fromEntries(entries.slice(0, StatsProcessor.CACHE_LIMIT_ENTRIES))
        Logger.debugThrottled(
          'cache-trim',
          `Trimmed stats cache to ${StatsProcessor.CACHE_LIMIT_ENTRIES} entries`,
          5000,
        )
      }

      await this.context.workspaceState.update(StatsProcessor.CACHE_KEY, this.statsCache)

      if (this.cacheHits + this.cacheMisses > 0) {
        const hitRate = Math.round((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100)
        Logger.debugThrottled(
          'cache-hit-rate',
          `Stats cache hit rate: ${hitRate}% (${this.cacheHits} hits, ${this.cacheMisses} misses)`,
          2000,
        )
      }
    } catch (error) {
      Logger.error('Failed to save stats cache', error as Error)
    }
  }

  public async enrichFileStats(targets: StagedFile[], token?: vscode.CancellationToken): Promise<void> {
    if (this._isDisposed) return

    const queue = targets.filter((f) => !f.stats)

    if (queue.length === 0) {
      Logger.debugThrottled('enrich-noop', `All ${targets.length} files already have stats`, 5000)
      return
    }

    Logger.debug(`Processing ${queue.length} files without stats (${targets.length} total)`)

    const processStart = Date.now()
    await this.processQueueConcurrent(queue, token)
    const processTime = Date.now() - processStart
    const avgTime = queue.length > 0 ? Math.round(processTime / queue.length) : 0

    Logger.debug(
      `File processing completed in ${processTime}ms (${avgTime}ms per file avg, ${queue.length} files processed concurrently)`,
    )

    await this.saveCache()
  }

  public async enrichFileStatsProgressive(
    targets: StagedFile[],
    onProgress: () => void,
    token?: vscode.CancellationToken,
  ): Promise<void> {
    if (this._isDisposed) return

    const queue = targets.filter((f) => !f.stats)

    if (queue.length === 0) {
      Logger.debugThrottled('enrich-noop', `All ${targets.length} files already have stats`, 5000)
      return
    }

    Logger.debug(`Processing ${queue.length} files without stats (${targets.length} total)`)

    const processStart = Date.now()
    await this.processQueueWithProgress(queue, onProgress, token)
    const processTime = Date.now() - processStart
    const avgTime = queue.length > 0 ? Math.round(processTime / queue.length) : 0

    Logger.debug(`File processing completed in ${processTime}ms (${avgTime}ms per file avg)`)

    await this.saveCache()
  }

  public measure(content: string): ContentStats {
    const measurements = TokenEstimator.measure(content)
    return {
      tokenCount: measurements.tokenCount,
      charCount: content.length,
    }
  }

  private async processQueueWithProgress(
    queue: StagedFile[],
    onProgress: () => void,
    token?: vscode.CancellationToken,
  ): Promise<void> {
    const concurrency = this.concurrencyLimit
    const progressInterval = concurrency

    for (let i = 0; i < queue.length; i += concurrency) {
      if (this._isDisposed || token?.isCancellationRequested) break

      const chunk = queue.slice(i, i + concurrency)
      await Promise.all(chunk.map((file) => this.processFileWithCache(file)))

      if ((i + concurrency) % progressInterval === 0 || i + concurrency >= queue.length) {
        onProgress()
      }

      if (i + concurrency < queue.length) {
        await this.yieldToEventLoop(1)
      }
    }
  }

  private async processQueueConcurrent(queue: StagedFile[], token?: vscode.CancellationToken): Promise<void> {
    const concurrency = this.concurrencyLimit

    for (let i = 0; i < queue.length; i += concurrency) {
      if (this._isDisposed || token?.isCancellationRequested) break

      const chunk = queue.slice(i, i + concurrency)
      await Promise.all(chunk.map((file) => this.processFileWithCache(file)))

      if (i + concurrency < queue.length) {
        await this.yieldToEventLoop(1)
      }
    }
  }

  private async processFileWithCache(file: StagedFile): Promise<void> {
    if (this._isDisposed) return

    try {
      const uriStr = file.uri.toString()
      const stat = await vscode.workspace.fs.stat(file.uri)

      const cached = this.statsCache[uriStr]
      if (cached && cached.mtime === stat.mtime && cached.size === stat.size) {
        file.stats = cached.stats
        file.isBinary = false
        this.cacheHits++
        return
      }

      this.cacheMisses++

      await this.processFile(file)

      if (file.stats) {
        this.statsCache[uriStr] = {
          mtime: stat.mtime,
          size: stat.size,
          stats: file.stats,
        }
      }
    } catch (error) {
      Logger.debugThrottled(`stats-fail-${file.uri.fsPath}`, `Stats read failed: ${file.uri.fsPath}`, 10000)
      this.setEmptyStats(file)
    }
  }

  private async processFile(file: StagedFile): Promise<void> {
    if (this._isDisposed) return

    try {
      const size = await this.getFileSize(file.uri)

      if (size > 5 * 1024 * 1024) {
        this.applyHeuristicStats(file, size)
        return
      }

      if (size > 1024 * 1024) {
        this.applyHeuristicStats(file, size)
        return
      }

      await this.analyzeExactStats(file)
    } catch (error) {
      Logger.debugThrottled(`proc-fail-${file.uri.fsPath}`, `Stats processing failed: ${file.uri.fsPath}`, 10000)
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
    try {
      const ext = path.extname(uri.fsPath).toLowerCase()

      if (KNOWN_BINARY_EXTENSIONS.has(ext)) {
        return null
      }

      const buffer = await vscode.workspace.fs.readFile(uri)

      if (KNOWN_TEXT_EXTENSIONS.has(ext)) {
        return this.decoder.decode(buffer)
      }

      if (this.isBinaryBuffer(buffer)) {
        return null
      }

      return this.decoder.decode(buffer)
    } catch {
      return null
    }
  }

  private isBinaryBuffer(buffer: Uint8Array): boolean {
    const checkLen = Math.min(buffer.length, 512)
    for (let i = 0; i < checkLen; i++) {
      if (buffer[i] === 0) return true
    }
    return false
  }

  private yieldToEventLoop(ms: number = 5): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
