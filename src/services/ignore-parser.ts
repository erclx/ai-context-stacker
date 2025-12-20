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

/**
 * Service responsible for parsing gitignore content into VS Code glob patterns.
 */
export class IgnoreParser {
  public static readonly DEFAULT_EXCLUDES = `{${FALLBACK_EXCLUDE_PATTERNS.join(',')}}`

  /**
   * Parses .gitignore content and merges with defaults.
   * Filters comments, negations, and converts to VS Code glob syntax.
   */
  public static generatePatternString(content: string): string {
    const userPatterns = content
      .split('\n')
      .map((line) => line.trim())
      // VS Code glob doesn't support gitignore comments and negations
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'))
      .map((line) => {
        // Convert to full glob paths with **/ prefix
        const cleanLine = line.replace(/^\//, '').replace(/\/$/, '')
        return `**/${cleanLine}`
      })

    // Avoid duplicates between user patterns and defaults
    const defaultsToAdd = FALLBACK_EXCLUDE_PATTERNS.filter((p) => !userPatterns.includes(p))
    const combinedPatterns = [...userPatterns, ...defaultsToAdd]

    return `{${combinedPatterns.join(',')}}`
  }
}
