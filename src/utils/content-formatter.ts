import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { Logger } from './logger'

interface TreeNode {
  [key: string]: TreeNode
}

export interface FormatOptions {
  skipTree?: boolean
  token?: vscode.CancellationToken
  maxTotalBytes?: number
}

// Configurable safety limits
const MAX_FILE_SIZE = 1024 * 1024 // 1MB
const BINARY_CHECK_BYTES = 512

// Hard safety cap to prevent V8 OOM crashes (100MB)
const DEFAULT_MAX_TOTAL_BYTES = 100 * 1024 * 1024

/**
 * Optimized formatter that uses Async Generators to stream content.
 * Prevents memory spikes by avoiding massive array concatenations.
 */
export class ContentFormatter {
  /**
   * Generates the context string as an async stream of chunks.
   * Best for large datasets or streaming to Webviews.
   */
  public static async *formatStream(
    files: StagedFile[],
    options: FormatOptions = {},
  ): AsyncGenerator<string, void, unknown> {
    if (files.length === 0 || options.token?.isCancellationRequested) return

    const includeTree = this.shouldIncludeTree(options)
    let currentTotalSize = 0
    const maxBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES

    // 1. Yield Context Map (Fast, metadata only)
    if (includeTree) {
      const tree = this.generateAsciiTree(files)
      const treeBlock = `# Context Map\n\`\`\`\n${tree}\`\`\`\n\n`

      currentTotalSize += treeBlock.length
      yield treeBlock
    }

    yield '# File Contents\n\n'

    // 2. Yield Files sequentially (Streaming IO)
    for (const file of files) {
      if (options.token?.isCancellationRequested) {
        Logger.info('Format operation cancelled by user.')
        return
      }

      // Pre-check size limit to fail fast
      if (currentTotalSize >= maxBytes) {
        Logger.warn(`Context limit reached (${maxBytes} bytes). Truncating output.`)
        yield `\n> [System]: Context limit of ${maxBytes / 1024 / 1024}MB reached. Output truncated.`
        return
      }

      const block = await this.formatFileBlock(file)

      if (block) {
        const output = block + '\n'
        currentTotalSize += output.length
        yield output
      }
    }
  }

  /**
   * Legacy-compatible wrapper that consumes the stream into a single string.
   * Includes safety checks to abort BEFORE string concatenation crashes V8.
   */
  public static async format(files: StagedFile[], options: FormatOptions = {}): Promise<string> {
    const parts: string[] = []
    let length = 0
    const maxBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES

    for await (const chunk of this.formatStream(files, options)) {
      length += chunk.length

      if (length > maxBytes) {
        // Optimization: Don't join if we already blew the limit
        vscode.window.showErrorMessage(
          `Context too large (> ${maxBytes / 1024 / 1024}MB). Copy aborted to prevent crash.`,
        )
        return ''
      }

      parts.push(chunk)
    }

    return parts.join('')
  }

  private static shouldIncludeTree(options: FormatOptions): boolean {
    const config = vscode.workspace.getConfiguration('aiContextStacker').get<boolean>('includeFileTree', true)
    return !!config && !options.skipTree
  }

  /**
   * Generates a visual ASCII tree structure of the staged files.
   * Pure CPU operation - no I/O.
   */
  public static generateAsciiTree(files: StagedFile[]): string {
    const paths = files.map((f) => vscode.workspace.asRelativePath(f.uri)).sort()
    const root: TreeNode = {}

    this.buildHierarchy(paths, root)
    return this.renderHierarchy(root)
  }

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
    const entries = Object.keys(node).sort((a, b) => {
      const aIsFolder = Object.keys(node[a]).length > 0
      const bIsFolder = Object.keys(node[b]).length > 0
      if (aIsFolder === bIsFolder) return a.localeCompare(b)
      return bIsFolder ? 1 : -1
    })

    const parts: string[] = []
    const count = entries.length

    for (let i = 0; i < count; i++) {
      const key = entries[i]
      const isLastChild = i === count - 1
      const connector = isLastChild ? '└── ' : '├── '

      parts.push(`${prefix}${connector}${key}\n`)

      const newPrefix = prefix + (isLastChild ? '    ' : '│   ')
      parts.push(this.renderHierarchy(node[key], newPrefix))
    }

    return parts.join('')
  }

  private static async formatFileBlock(file: StagedFile): Promise<string | null> {
    if (file.isBinary) return this.skipMessage(file, 'binary file')

    try {
      const stats = await vscode.workspace.fs.stat(file.uri)
      if (stats.size > MAX_FILE_SIZE) {
        Logger.warn(`Skipping large file (${stats.size} bytes): ${file.uri.fsPath}`)
        return this.skipMessage(file, 'large file (>1MB)')
      }

      const content = await this.readFileContent(file.uri)
      if (content === null) return null

      const relativePath = vscode.workspace.asRelativePath(file.uri)
      const extension = file.uri.path.split('.').pop() || ''
      return `File: ${relativePath}\n\`\`\`${extension}\n${content}\n\`\`\``
    } catch (err) {
      Logger.error(`Failed to read file ${file.uri.fsPath}`, err)
      return `> Error reading file: ${vscode.workspace.asRelativePath(file.uri)}`
    }
  }

  private static skipMessage(file: StagedFile, reason: string): string {
    return `> Skipped ${reason}: ${vscode.workspace.asRelativePath(file.uri)}\n`
  }

  private static async readFileContent(uri: vscode.Uri): Promise<string | null> {
    const uint8Array = await vscode.workspace.fs.readFile(uri)
    const checkLength = Math.min(uint8Array.length, BINARY_CHECK_BYTES)

    for (let i = 0; i < checkLength; i++) {
      if (uint8Array[i] === 0) return null
    }

    return Buffer.from(uint8Array).toString('utf-8')
  }
}
