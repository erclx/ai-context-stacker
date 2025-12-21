const FALLBACK_EXCLUDE_PATTERNS = [
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
  '**/__pycache__/**',
  '**/.venv/**',
  '**/venv/**',
  '**/.env',
  '**/*.pyc',
  '**/.vscode/**',
  '**/*.log',
  '**/.DS_Store',
]

const RX_LEADING_SLASH = /^\//
const RX_TRAILING_SLASH = /\/$/
const RX_STARTS_WITH_STARS = /^\*\*/

/**
 * Service responsible for parsing gitignore content into VS Code glob patterns.
 * Optimized for startup speed.
 */
export class IgnoreParser {
  public static readonly DEFAULT_EXCLUDES = `{${FALLBACK_EXCLUDE_PATTERNS.join(',')}}`

  public static generatePatternString(content: string, userExcludes: string[] = []): string {
    const gitPatterns = this.parseRawLines(content)
    const userPatterns = this.formatUserPatterns(userExcludes)

    const patternSet = new Set([...gitPatterns, ...userPatterns])

    // Add defaults if missing
    for (const def of FALLBACK_EXCLUDE_PATTERNS) {
      if (!patternSet.has(def)) {
        patternSet.add(def)
      }
    }

    return `{${Array.from(patternSet).join(',')}}`
  }

  private static parseRawLines(content: string): string[] {
    if (!content) return []

    // Split by newline regex handles \r\n and \n uniformly
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'))
      .map((line) => this.convertToGlob(line))
  }

  private static formatUserPatterns(patterns: string[]): string[] {
    return patterns.map((p) => this.convertToGlob(p))
  }

  private static convertToGlob(line: string): string {
    let cleanLine = line

    if (RX_LEADING_SLASH.test(cleanLine)) cleanLine = cleanLine.replace(RX_LEADING_SLASH, '')
    if (RX_TRAILING_SLASH.test(cleanLine)) cleanLine = cleanLine.replace(RX_TRAILING_SLASH, '')

    return RX_STARTS_WITH_STARS.test(cleanLine) ? cleanLine : `**/${cleanLine}`
  }
}
