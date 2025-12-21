import * as vscode from 'vscode'

import { type StagedFile } from '../models'
import { Logger } from './logger'

interface TreeNode {
  [key: string]: TreeNode
}

export interface FormatOptions {
  skipTree?: boolean
}

/**
 * Formats staged files into Markdown code blocks and generates ASCII trees.
 */
export class ContentFormatter {
  /**
   * Reads/formats files and conditionally prepends the ASCII File Tree.
   * @param options.skipTree - If true, forces the tree to be omitted regardless of user settings.
   */
  public static async format(files: StagedFile[], options: FormatOptions = {}): Promise<string> {
    const configIncludeTree = vscode.workspace
      .getConfiguration('aiContextStacker')
      .get<boolean>('includeFileTree', true)

    // Logic: Include tree only if Config says YES AND override says don't skip.
    const shouldIncludeTree = configIncludeTree && !options.skipTree

    const fileContent = await this.generateFileBlocks(files)

    if (shouldIncludeTree && files.length > 0) {
      const tree = this.generateAsciiTree(files)
      return `# Context Map\n\`\`\`\n${tree}\`\`\`\n\n# File Contents\n\n${fileContent}`
    }

    return fileContent
  }

  /**
   * Generates a visual ASCII tree structure of the staged files.
   */
  public static generateAsciiTree(files: StagedFile[]): string {
    const paths = files.map((f) => vscode.workspace.asRelativePath(f.uri)).sort()
    const root: TreeNode = {}

    this.buildHierarchy(paths, root)
    return this.renderHierarchy(root)
  }

  private static buildHierarchy(paths: string[], root: TreeNode) {
    paths.forEach((path) => {
      let current = root
      path.split(/[/\\]/).forEach((segment) => {
        if (!current[segment]) current[segment] = {}
        current = current[segment]
      })
    })
  }

  private static renderHierarchy(node: TreeNode, prefix = '', isLast = true): string {
    const entries = Object.keys(node).sort((a, b) => {
      const aIsFolder = Object.keys(node[a]).length > 0
      const bIsFolder = Object.keys(node[b]).length > 0
      if (aIsFolder === bIsFolder) return a.localeCompare(b)
      return bIsFolder ? 1 : -1
    })

    return entries
      .map((key, index) => {
        const childIsLast = index === entries.length - 1
        const connector = childIsLast ? '└── ' : '├── '
        const childPrefix = prefix + (childIsLast ? '    ' : '│   ')

        const subtree = this.renderHierarchy(node[key], childPrefix, childIsLast)
        return `${prefix}${connector}${key}\n${subtree}`
      })
      .join('')
  }

  private static async generateFileBlocks(files: StagedFile[]): Promise<string> {
    const parts = await Promise.all(files.map((f) => this.formatFileBlock(f)))
    return parts.filter((p) => p !== '').join('\n')
  }

  private static async formatFileBlock(file: StagedFile): Promise<string> {
    if (file.isBinary) {
      return `> Skipped binary file: ${vscode.workspace.asRelativePath(file.uri)}\n`
    }

    try {
      const content = await this.readFileContent(file.uri)
      if (content === null) return ''

      const relativePath = vscode.workspace.asRelativePath(file.uri)
      const extension = file.uri.path.split('.').pop() || ''
      return [`File: ${relativePath}`, '```' + extension, content, '```\n'].join('\n')
    } catch (err) {
      Logger.error(`Failed to read file ${file.uri.fsPath}`, err)
      return `> Error reading file: ${vscode.workspace.asRelativePath(file.uri)}`
    }
  }

  private static async readFileContent(uri: vscode.Uri): Promise<string | null> {
    const uint8Array = await vscode.workspace.fs.readFile(uri)
    if (uint8Array.slice(0, 512).some((b) => b === 0)) return null
    return Buffer.from(uint8Array).toString('utf-8')
  }
}
