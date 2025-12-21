import * as vscode from 'vscode'

import { type StagedFile } from '../models'
import { Logger } from './logger'

interface TreeNode {
  [key: string]: TreeNode
}

export interface FormatOptions {
  skipTree?: boolean
  token?: vscode.CancellationToken
}

// Configurable safety limits
const MAX_FILE_SIZE = 1024 * 1024 // 1MB
const BINARY_CHECK_BYTES = 512

/**
 * Optimized formatter that processes files sequentially to minimize memory footprint.
 */
export class ContentFormatter {
  /**
   * Reads/formats files and conditionally prepends the ASCII File Tree.
   * Processes files sequentially to prevent GC pressure/OOM.
   */
  public static async format(files: StagedFile[], options: FormatOptions = {}): Promise<string> {
    if (files.length === 0) return ''

    // Fast configuration check
    const configIncludeTree = vscode.workspace
      .getConfiguration('aiContextStacker')
      .get<boolean>('includeFileTree', true)

    const shouldIncludeTree = configIncludeTree && !options.skipTree

    // Check cancellation before heavy lifting
    if (options.token?.isCancellationRequested) return ''

    let output = ''
    if (shouldIncludeTree) {
      const tree = this.generateAsciiTree(files)
      output += `# Context Map\n\`\`\`\n${tree}\`\`\`\n\n# File Contents\n\n`
    } else {
      output += `# File Contents\n\n`
    }

    // We append directly to the string to avoid holding an array of all file contents in memory
    for (const file of files) {
      if (options.token?.isCancellationRequested) {
        Logger.info('Format operation cancelled by user.')
        return ''
      }

      const block = await this.formatFileBlock(file)
      if (block) {
        output += block + '\n'
      }
    }

    return output
  }

  /**
   * Generates a visual ASCII tree structure of the staged files.
   * Pure synchronous operation - fast enough to run on main thread for <1000 files.
   */
  public static generateAsciiTree(files: StagedFile[]): string {
    const paths = files.map((f) => vscode.workspace.asRelativePath(f.uri)).sort()
    const root: TreeNode = {}

    this.buildHierarchy(paths, root)
    return this.renderHierarchy(root)
  }

  private static buildHierarchy(paths: string[], root: TreeNode) {
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

    let result = ''
    const count = entries.length

    for (let i = 0; i < count; i++) {
      const key = entries[i]
      const isLastChild = i === count - 1
      const connector = isLastChild ? '└── ' : '├── '

      result += `${prefix}${connector}${key}\n`

      const newPrefix = prefix + (isLastChild ? '    ' : '│   ')
      result += this.renderHierarchy(node[key], newPrefix)
    }

    return result
  }

  private static async formatFileBlock(file: StagedFile): Promise<string | null> {
    if (file.isBinary) {
      return `> Skipped binary file: ${vscode.workspace.asRelativePath(file.uri)}\n`
    }

    try {
      // Check size metadata before reading content
      const stats = await vscode.workspace.fs.stat(file.uri)
      if (stats.size > MAX_FILE_SIZE) {
        Logger.warn(`Skipping large file (${stats.size} bytes): ${file.uri.fsPath}`)
        return `> Skipped large file (>1MB): ${vscode.workspace.asRelativePath(file.uri)}\n`
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

  private static async readFileContent(uri: vscode.Uri): Promise<string | null> {
    const uint8Array = await vscode.workspace.fs.readFile(uri)

    const checkLength = Math.min(uint8Array.length, BINARY_CHECK_BYTES)
    for (let i = 0; i < checkLength; i++) {
      if (uint8Array[i] === 0) return null
    }

    return Buffer.from(uint8Array).toString('utf-8')
  }
}
