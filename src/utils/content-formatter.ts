import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { Logger } from './logger'

interface TreeNode {
  [key: string]: TreeNode
}

export interface FormatOptions {
  token?: vscode.CancellationToken
  maxTotalBytes?: number
  skipTree?: boolean
}

interface FormatterConfig {
  includeTree: boolean
  maxSizeBytes: number
}

/**
 * Optimized formatter that uses Async Generators to stream content.
 * Exposes static utilities for specific format operations.
 */
export class ContentFormatter {
  private static readonly DEFAULT_MAX_BYTES = 100 * 1024 * 1024 // 100MB
  private static readonly FILE_SIZE_LIMIT = 1024 * 1024 // 1MB

  /**
   * Orchestrates the context generation stream.
   */
  public static async *formatStream(
    files: StagedFile[],
    opts: FormatOptions = {},
  ): AsyncGenerator<string, void, unknown> {
    if (files.length === 0 || opts.token?.isCancellationRequested) return

    const config = this.getConfig(opts)
    let currentTotalSize = 0

    if (config.includeTree) {
      const tree = this.generateAsciiTree(files)
      const treeBlock = `# Context Map\n\`\`\`\n${tree}\`\`\`\n\n`
      currentTotalSize += treeBlock.length
      yield treeBlock
    }

    yield '# File Contents\n\n'
    yield* this.streamFiles(files, config, currentTotalSize, opts.token)
  }

  /**
   * Legacy wrapper for non-streaming consumers.
   */
  public static async format(files: StagedFile[], opts: FormatOptions = {}): Promise<string> {
    const parts: string[] = []
    let length = 0
    const limit = opts.maxTotalBytes ?? this.DEFAULT_MAX_BYTES

    for await (const chunk of this.formatStream(files, opts)) {
      length += chunk.length
      if (length > limit) return ''
      parts.push(chunk)
    }
    return parts.join('')
  }

  /**
   * Public Utility: Generates just the visual ASCII tree.
   * Useful for "Copy Tree" commands.
   */
  public static generateAsciiTree(files: StagedFile[]): string {
    const paths = files.map((f) => vscode.workspace.asRelativePath(f.uri)).sort()
    const root: TreeNode = {}

    this.buildHierarchy(paths, root)
    return this.renderHierarchy(root)
  }

  // --- Configuration & Helpers ---

  private static getConfig(opts: FormatOptions): FormatterConfig {
    const cfg = vscode.workspace.getConfiguration('aiContextStacker')

    // Command option takes precedence over user settings
    const includeTree = opts.skipTree ? false : cfg.get<boolean>('includeFileTree', true)

    return {
      includeTree,
      maxSizeBytes: opts.maxTotalBytes ?? this.DEFAULT_MAX_BYTES,
    }
  }

  private static async *streamFiles(
    files: StagedFile[],
    config: FormatterConfig,
    initialSize: number,
    token?: vscode.CancellationToken,
  ): AsyncGenerator<string, void, unknown> {
    let currentSize = initialSize

    for (const file of files) {
      if (token?.isCancellationRequested) break

      if (currentSize >= config.maxSizeBytes) {
        yield `\n> [System]: Context limit (${config.maxSizeBytes}B) reached.\n`
        break
      }

      const block = await this.processFile(file)
      if (block) {
        const output = block + '\n'
        currentSize += output.length
        yield output
      }
    }
  }

  // --- Tree Logic (Internal) ---

  private static buildHierarchy(paths: string[], root: TreeNode): void {
    for (const path of paths) {
      let current = root
      const segments = path.split(/[/\\]/)
      for (const segment of segments) {
        if (!current[segment]) current[segment] = {}
        current = current[segment]
      }
    }
  }

  private static renderHierarchy(node: TreeNode, prefix = ''): string {
    const entries = Object.keys(node).sort(this.sortNodes(node))
    const parts: string[] = []

    for (let i = 0; i < entries.length; i++) {
      const key = entries[i]
      const isLast = i === entries.length - 1

      parts.push(`${prefix}${isLast ? '└── ' : '├── '}${key}\n`)

      const childPrefix = prefix + (isLast ? '    ' : '│   ')
      parts.push(this.renderHierarchy(node[key], childPrefix))
    }

    return parts.join('')
  }

  private static sortNodes(node: TreeNode): (a: string, b: string) => number {
    return (a, b) => {
      const aIsDir = Object.keys(node[a]).length > 0
      const bIsDir = Object.keys(node[b]).length > 0
      if (aIsDir === bIsDir) return a.localeCompare(b)
      return bIsDir ? 1 : -1
    }
  }

  // --- File Processing (Internal) ---

  private static async processFile(file: StagedFile): Promise<string | null> {
    const validationError = await this.validateFile(file)
    if (validationError) {
      return this.makeSkipMsg(file, validationError)
    }

    try {
      const content = await this.readFileSafely(file.uri)
      if (content === null) {
        return this.makeSkipMsg(file, 'binary file')
      }
      return this.formatBlock(file, content)
    } catch (err) {
      Logger.error(`Read failed: ${file.uri.fsPath}`, err)
      return `> Error reading: ${vscode.workspace.asRelativePath(file.uri)}`
    }
  }

  private static async validateFile(file: StagedFile): Promise<string | null> {
    if (file.isBinary) return 'binary file'

    const stats = await vscode.workspace.fs.stat(file.uri)
    if (stats.size > this.FILE_SIZE_LIMIT) {
      return 'large file (>1MB)'
    }

    return null
  }

  private static async readFileSafely(uri: vscode.Uri): Promise<string | null> {
    const data = await vscode.workspace.fs.readFile(uri)
    const checkLen = Math.min(data.length, 512)

    // Binary check
    for (let i = 0; i < checkLen; i++) {
      if (data[i] === 0) return null
    }

    return Buffer.from(data).toString('utf-8')
  }

  private static formatBlock(file: StagedFile, content: string): string {
    const relPath = vscode.workspace.asRelativePath(file.uri)
    const ext = file.uri.path.split('.').pop() || ''
    return `File: ${relPath}\n\`\`\`${ext}\n${content}\n\`\`\``
  }

  private static makeSkipMsg(file: StagedFile, reason: string): string {
    const path = vscode.workspace.asRelativePath(file.uri)
    return `> Skipped ${reason}: ${path}\n`
  }
}
