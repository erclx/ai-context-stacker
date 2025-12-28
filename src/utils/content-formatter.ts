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
  showTreeMap: boolean
  showTreeMapHeader: boolean
  treeMapText: string
  includeFileContents: boolean
  showFileContentsHeader: boolean
  fileContentsText: string
  maxSizeBytes: number
}

export class ContentFormatter {
  private static readonly DEFAULT_MAX_BYTES = 100 * 1024 * 1024
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024

  public static async *formatStream(
    files: StagedFile[],
    opts: FormatOptions = {},
  ): AsyncGenerator<string, void, unknown> {
    if (files.length === 0 || opts.token?.isCancellationRequested) return

    const config = this.getConfig(opts)
    let currentTotalSize = 0

    if (config.showTreeMap) {
      const treeBlock = this.generateTreeBlock(files, config)
      currentTotalSize += treeBlock.length
      yield treeBlock
    }

    if (config.includeFileContents) {
      if (config.showFileContentsHeader) {
        yield this.renderHeader(config.fileContentsText)
      }
      yield* this.streamFileContent(files, config, currentTotalSize, opts.token)
    }
  }

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

  public static generateAsciiTree(files: StagedFile[]): string {
    const paths = files.map((f) => this.getDisplayPath(f.uri)).sort()
    const root: TreeNode = {}

    this.buildHierarchy(paths, root)
    return this.renderHierarchyIterative(root)
  }

  private static getConfig(opts: FormatOptions): FormatterConfig {
    const cfg = vscode.workspace.getConfiguration('aiContextStacker')
    const userTreeMap = cfg.get<boolean>('showTreeMap', true)

    return {
      showTreeMap: opts.skipTree ? false : userTreeMap,
      showTreeMapHeader: cfg.get<boolean>('showTreeMapHeader', true),
      treeMapText: cfg.get<string>('treeMapText', '# Context Map'),
      includeFileContents: cfg.get<boolean>('includeFileContents', true),
      showFileContentsHeader: cfg.get<boolean>('showFileContentsHeader', true),
      fileContentsText: cfg.get<string>('fileContentsText', '# File Contents'),
      maxSizeBytes: opts.maxTotalBytes ?? this.DEFAULT_MAX_BYTES,
    }
  }

  private static generateTreeBlock(files: StagedFile[], config: FormatterConfig): string {
    const tree = this.generateAsciiTree(files)

    let header = ''
    if (config.showTreeMapHeader) {
      header = this.renderHeader(config.treeMapText)
    }

    return `${header}\`\`\`\n${tree}\`\`\`\n\n`
  }

  private static renderHeader(text: string): string {
    if (!text || !text.trim()) {
      return ''
    }
    return `${text}\n\n`
  }

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

    if (this.isBinaryBuffer(data)) return null

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
    const relPath = this.getDisplayPath(file.uri)
    const ext = file.uri.path.split('.').pop() || ''
    return `File: ${relPath}\n\`\`\`${ext}\n${content}\n\`\`\`\n`
  }

  private static makeSkipMsg(file: StagedFile, reason: string): string {
    const path = this.getDisplayPath(file.uri)
    return `> Skipped ${reason}: ${path}\n`
  }

  private static getDisplayPath(uri: vscode.Uri): string {
    const isMultiRoot = (vscode.workspace.workspaceFolders?.length ?? 0) > 1
    return vscode.workspace.asRelativePath(uri, isMultiRoot)
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

  private static renderHierarchyIterative(root: TreeNode): string {
    const parts: string[] = []
    const rootEntries = Object.keys(root).sort(this.sortNodes(root))

    const stack: TreeStackItem[] = [{ node: root, prefix: '', entries: rootEntries, index: 0 }]

    while (stack.length > 0) {
      this.processStackItem(stack, parts)
    }

    return parts.join('')
  }

  private static processStackItem(stack: TreeStackItem[], parts: string[]): void {
    const current = stack[stack.length - 1]

    if (current.index >= current.entries.length) {
      stack.pop()
      return
    }

    const key = current.entries[current.index]
    const isLast = current.index === current.entries.length - 1
    current.index++

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
