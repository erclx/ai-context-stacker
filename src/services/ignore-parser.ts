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
const RX_NEWLINE = /\r?\n/

/**
 * Service responsible for parsing gitignore content into VS Code glob patterns.
 * Optimized for startup speed.
 */
export class IgnoreParser {
  public static readonly DEFAULT_EXCLUDES = `{${FALLBACK_EXCLUDE_PATTERNS.join(',')}}`

  /**
   * Merges .gitignore content, user settings, and defaults into a single glob string.
   */
  public static generatePatternString(content: string, userExcludes: string[] = []): string {
    // 1. Parse sources
    const gitPatterns = this.parseGitContent(content)
    const userPatterns = this.formatUserPatterns(userExcludes)

    // 2. Unify and deduplicate
    const patternSet = new Set([...gitPatterns, ...userPatterns])

    // 3. Ensure safeguards (Defaults)
    FALLBACK_EXCLUDE_PATTERNS.forEach((def) => patternSet.add(def))

    return `{${Array.from(patternSet).join(',')}}`
  }

  private static parseGitContent(content: string): string[] {
    if (!content) return []

    return content
      .split(RX_NEWLINE)
      .map((line) => line.trim())
      .filter((line) => this.isValidLine(line))
      .map((line) => this.convertToGlob(line))
  }

  private static isValidLine(line: string): boolean {
    // Filter empty lines, comments (#), and negations (!)
    // Note: Negations are not supported in standard VS Code findFiles excludes
    return line.length > 0 && !line.startsWith('#') && !line.startsWith('!')
  }

  private static formatUserPatterns(patterns: string[]): string[] {
    return patterns.map((p) => this.convertToGlob(p))
  }

  private static convertToGlob(line: string): string {
    let cleanLine = line

    if (RX_LEADING_SLASH.test(cleanLine)) {
      cleanLine = cleanLine.replace(RX_LEADING_SLASH, '')
    }

    if (RX_TRAILING_SLASH.test(cleanLine)) {
      cleanLine = cleanLine.replace(RX_TRAILING_SLASH, '')
    }

    // Ensure deep matching for generic names (e.g., 'dist' -> '**/dist')
    return RX_STARTS_WITH_STARS.test(cleanLine) ? cleanLine : `**/${cleanLine}`
  }
}
