import * as vscode from 'vscode'

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
      console.log('[AI Context Stacker] .gitignore changed, invalidating cache.')
      this._cachedPatterns = undefined
    }

    this._watcher.onDidCreate(invalidate)
    this._watcher.onDidChange(invalidate)
    this._watcher.onDidDelete(invalidate)
  }

  public async getExcludePatterns(): Promise<string> {
    if (this._cachedPatterns) {
      return this._cachedPatterns
    }

    console.log('[AI Context Stacker] Reading .gitignore from disk...')
    this._cachedPatterns = await this.readGitIgnore()
    return this._cachedPatterns
  }

  private async readGitIgnore(): Promise<string> {
    try {
      const files = await vscode.workspace.findFiles('.gitignore', null, 1)

      if (files.length === 0) {
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

      return `{${finalPatterns.join(',')}}`
    } catch (error) {
      console.error('Error reading .gitignore:', error)
      return this.DEFAULT_EXCLUDES
    }
  }

  public dispose() {
    this._watcher?.dispose()
  }
}
