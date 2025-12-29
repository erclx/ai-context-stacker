import { FALLBACK_EXCLUDE_PATTERNS } from '../constants'

const RX_LEADING_SLASH = /^\//
const RX_TRAILING_SLASH = /\/$/
const RX_STARTS_WITH_STARS = /^\*\*/
const RX_NEWLINE = /\r?\n/

export class IgnoreParser {
  public static readonly DEFAULT_EXCLUDES = `{${FALLBACK_EXCLUDE_PATTERNS.join(',')}}`

  public static generatePatternString(content: string, userExcludes: string[] = []): string {
    const gitPatterns = this.parseGitContent(content)
    const userPatterns = this.formatUserPatterns(userExcludes)

    const patternSet = new Set([...gitPatterns, ...userPatterns])

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

    return RX_STARTS_WITH_STARS.test(cleanLine) ? cleanLine : `**/${cleanLine}`
  }
}
