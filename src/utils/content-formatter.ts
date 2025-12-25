import { TextDecoder } from 'util'
import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { Logger } from './logger'

interface TreeNode {
  [key: string]: TreeNode
}

interface TreeStackItem {
  node: TreeNode
  prefix: string
  entries: string[]
  index: number
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
 * Optimized formatter using Async Generators and iterative algorithms.
 */
export class ContentFormatter {
  private static readonly DEFAULT_MAX_BYTES = 100 * 1024 * 1024 // 100MB
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB Hard Cap

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
      const treeBlock = this.generateTreeBlock(files)
      currentTotalSize += treeBlock.length
      yield treeBlock
    }

    yield '# File Contents\n\n'
    yield* this.streamFileContent(files, config, currentTotalSize, opts.token)
  }

  /**
   * Accumulates the stream into a single string.
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
   * Generates a visual ASCII tree using an iterative stack approach.
   */
  public static generateAsciiTree(files: StagedFile[]): string {
    const paths = files.map((f) => vscode.workspace.asRelativePath(f.uri)).sort()
    const root: TreeNode = {}

    this.buildHierarchy(paths, root)
    return this.renderHierarchyIterative(root)
  }

  // --- Configuration ---

  private static getConfig(opts: FormatOptions): FormatterConfig {
    const cfg = vscode.workspace.getConfiguration('aiContextStacker')
    const includeTree = opts.skipTree ? false : cfg.get<boolean>('includeFileTree', true)

    return {
      includeTree,
      maxSizeBytes: opts.maxTotalBytes ?? this.DEFAULT_MAX_BYTES,
    }
  }

  private static generateTreeBlock(files: StagedFile[]): string {
    const tree = this.generateAsciiTree(files)
    return `# Context Map\n\`\`\`\n${tree}\`\`\`\n\n`
  }

  // --- Streaming Logic ---

  private static async *streamFileContent(
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
        currentSize += block.length
        yield block
      }
    }
  }

  // --- File Processing ---

  private static async processFile(file: StagedFile): Promise<string | null> {
    const validationError = await this.validateFile(file)
    if (validationError) {
      return this.makeSkipMsg(file, validationError)
    }

    try {
      const content = await this.readFileSafely(file.uri)
      if (content === null) {
        return this.makeSkipMsg(file, 'binary or unreadable')
      }
      return this.formatBlock(file, content)
    } catch (err) {
      Logger.error(`Read failed: ${file.uri.fsPath}`, err)
      return this.makeSkipMsg(file, 'read error')
    }
  }

  private static async validateFile(file: StagedFile): Promise<string | null> {
    if (file.isBinary) return 'binary file'

    const stats = await vscode.workspace.fs.stat(file.uri)
    if (stats.size > this.MAX_FILE_SIZE) {
      return `large file (>${this.MAX_FILE_SIZE / 1024 / 1024}MB)`
    }

    return null
  }

  private static async readFileSafely(uri: vscode.Uri): Promise<string | null> {
    const data = await vscode.workspace.fs.readFile(uri)

    // Quick binary check on first 512 bytes
    if (this.isBinaryBuffer(data)) return null

    // Safe decode
    const decoder = new TextDecoder('utf-8', { fatal: false })
    return decoder.decode(data)
  }

  private static isBinaryBuffer(data: Uint8Array): boolean {
    const checkLen = Math.min(data.length, 512)
    for (let i = 0; i < checkLen; i++) {
      if (data[i] === 0) return true
    }
    return false
  }

  private static formatBlock(file: StagedFile, content: string): string {
    const relPath = vscode.workspace.asRelativePath(file.uri)
    const ext = file.uri.path.split('.').pop() || ''
    return `File: ${relPath}\n\`\`\`${ext}\n${content}\n\`\`\`\n`
  }

  private static makeSkipMsg(file: StagedFile, reason: string): string {
    const path = vscode.workspace.asRelativePath(file.uri)
    return `> Skipped ${reason}: ${path}\n`
  }

  // --- Tree Logic (Iterative) ---

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

  /**
   * Renders the tree using a stack to avoid recursion limits.
   */
  private static renderHierarchyIterative(root: TreeNode): string {
    const parts: string[] = []
    const rootEntries = Object.keys(root).sort(this.sortNodes(root))

    // Stack stores state for each level of depth
    const stack: TreeStackItem[] = [{ node: root, prefix: '', entries: rootEntries, index: 0 }]

    while (stack.length > 0) {
      this.processStackItem(stack, parts)
    }

    return parts.join('')
  }

  private static processStackItem(stack: TreeStackItem[], parts: string[]): void {
    const current = stack[stack.length - 1]

    if (current.index >= current.entries.length) {
      stack.pop() // Level complete
      return
    }

    const key = current.entries[current.index]
    const isLast = current.index === current.entries.length - 1
    current.index++ // Advance for next iteration

    parts.push(`${current.prefix}${isLast ? '└── ' : '├── '}${key}\n`)

    const childNode = current.node[key]
    const childEntries = Object.keys(childNode).sort(this.sortNodes(childNode))

    if (childEntries.length > 0) {
      const childPrefix = current.prefix + (isLast ? '    ' : '│   ')
      stack.push({
        node: childNode,
        prefix: childPrefix,
        entries: childEntries,
        index: 0,
      })
    }
  }

  private static sortNodes(node: TreeNode): (a: string, b: string) => number {
    return (a, b) => {
      const aIsDir = Object.keys(node[a]).length > 0
      const bIsDir = Object.keys(node[b]).length > 0
      if (aIsDir === bIsDir) return a.localeCompare(b)
      return bIsDir ? 1 : -1
    }
  }
}
