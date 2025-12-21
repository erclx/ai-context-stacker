const FALLBACK_EXCLUDE_PATTERNS = [
  // Node / JS
  '**/.git/**',
  '**/node_modules/**',
  '**/build/**',
  '**/dist/**',
  '**/out/**',
  '**/coverage/**',
  '**/.cache/**',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/bun.lockb',
  '**/.bun/**',

  // Python
  '**/__pycache__/**',
  '**/.venv/**',
  '**/venv/**',
  '**/.env',
  '**/*.pyc',

  // System / VS Code
  '**/.vscode/**',
  '**/*.log',
  '**/.DS_Store',
]

/**
 * Service responsible for parsing gitignore content into VS Code glob patterns.
 */
export class IgnoreParser {
  public static readonly DEFAULT_EXCLUDES = `{${FALLBACK_EXCLUDE_PATTERNS.join(',')}}`

  /**
   * Parses .gitignore content, merges with User Settings and Default Fallbacks.
   * @param content - Raw string content of .gitignore (can be empty string).
   * @param userExcludes - Array of patterns from VS Code configuration.
   */
  public static generatePatternString(content: string, userExcludes: string[] = []): string {
    const gitPatterns = this.parseRawLines(content)
    const userPatterns = this.formatUserPatterns(userExcludes)

    // Merge User settings + GitIgnore patterns
    const activePatterns = [...gitPatterns, ...userPatterns]

    // Add Fallbacks only if they are not already covered
    const defaultsToAdd = FALLBACK_EXCLUDE_PATTERNS.filter((p) => !activePatterns.includes(p))

    return `{${[...activePatterns, ...defaultsToAdd].join(',')}}`
  }

  private static parseRawLines(content: string): string[] {
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'))
      .map((line) => this.convertToGlob(line))
  }

  private static formatUserPatterns(patterns: string[]): string[] {
    return patterns.map((p) => this.convertToGlob(p))
  }

  private static convertToGlob(line: string): string {
    // Clean leading/trailing slashes and ensure **/ prefix for robust matching
    const cleanLine = line.replace(/^\//, '').replace(/\/$/, '')
    return cleanLine.startsWith('**') ? cleanLine : `**/${cleanLine}`
  }
}
