import * as vscode from 'vscode'

import { Logger } from '../utils'

const FALLBACK_EXCLUDE_PATTERNS = [
  '**/.git/**',
  '**/node_modules/**',
  '**/build/**',
  '**/dist/**',
  '**/out/**',
  '**/.vscode/**',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/*.log',
  '**/.DS_Store',
]

export class IgnorePatternProvider {
  private _cachedPatterns: string | undefined
  private _watcher: vscode.FileSystemWatcher | undefined

  private readonly DEFAULT_EXCLUDES: string = `{${FALLBACK_EXCLUDE_PATTERNS.join(',')}}`

  constructor() {
    this.initWatcher()
  }

  private initWatcher() {
    this._watcher = vscode.workspace.createFileSystemWatcher('**/.gitignore')

    const invalidate = () => {
      Logger.info('Ignore patterns cache invalidated (due to .gitignore change).')
      this._cachedPatterns = undefined
    }

    this._watcher.onDidCreate(invalidate)
    this._watcher.onDidChange(invalidate)
    this._watcher.onDidDelete(invalidate)
  }

  public async getExcludePatterns(): Promise<string> {
    if (this._cachedPatterns) {
      Logger.info('Ignore patterns cache hit.')
      return this._cachedPatterns
    }

    Logger.info('Ignore patterns cache miss. Generating patterns from disk...')
    this._cachedPatterns = await this.readGitIgnore()
    return this._cachedPatterns
  }

  private async readGitIgnore(): Promise<string> {
    try {
      const files = await vscode.workspace.findFiles('.gitignore', null, 1)

      if (files.length === 0) {
        Logger.info('.gitignore not found. Using fallback excludes.')
        return this.DEFAULT_EXCLUDES
      }

      const uri = files[0]
      const uint8Array = await vscode.workspace.fs.readFile(uri)
      const content = Buffer.from(uint8Array).toString('utf-8')

      const userPatterns = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'))
        .map((line) => {
          const cleanLine = line.replace(/^\//, '').replace(/\/$/, '')
          return `**/${cleanLine}`
        })

      const standardExcludes = FALLBACK_EXCLUDE_PATTERNS.filter((p) => !userPatterns.includes(p))

      const combinedPatternsArray = [...userPatterns, ...standardExcludes]
      const finalPatterns = combinedPatternsArray.filter((p) => p.length > 0)

      Logger.info('.gitignore parsed; exclusion patterns generated.')
      return `{${finalPatterns.join(',')}}`
    } catch (error) {
      Logger.error('Error reading/parsing .gitignore. Reverting to fallback excludes.', error)
      return this.DEFAULT_EXCLUDES
    }
  }

  public dispose() {
    this._watcher?.dispose()
    Logger.info('IgnorePatternProvider disposed: FileSystemWatcher cleaned up.')
  }
}
