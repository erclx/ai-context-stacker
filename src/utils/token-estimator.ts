/**
 * Standalone interface to prevent circular dependencies with Models.
 */
export interface SimpleStats {
  tokenCount: number
  charCount: number
}

/**
 * Provides high-performance token estimation using hybrid scanning and heuristics.
 */
export class TokenEstimator {
  private static readonly LARGE_FILE_THRESHOLD = 100 * 1024
  private static readonly CHARS_PER_TOKEN_RATIO = 4
  private static readonly WORDS_TO_TOKENS_RATIO = 1.3

  /**
   * Estimates token count for a given string using performance-optimized heuristics.
   * @param text - Raw content analysis target
   */
  public static measure(text: string): SimpleStats {
    if (!text) {
      return { tokenCount: 0, charCount: 0 }
    }

    const charCount = text.length
    const tokenCount = this.computeTokenCount(text, charCount)

    return { tokenCount, charCount }
  }

  public static format(stats: SimpleStats): string {
    return `~${stats.tokenCount.toLocaleString()} tokens`
  }

  private static computeTokenCount(text: string, charCount: number): number {
    // Optimization: Skip expensive iteration for large files
    if (charCount > this.LARGE_FILE_THRESHOLD) {
      return Math.ceil(charCount / this.CHARS_PER_TOKEN_RATIO)
    }

    const wordCount = this.countWordsIterative(text, charCount)
    return this.finalizeEstimate(wordCount, charCount)
  }

  /**
   * O(N) state-machine scanner avoiding regex overhead.
   */
  private static countWordsIterative(text: string, length: number): number {
    let wordCount = 0
    let inWord = false

    for (let i = 0; i < length; i++) {
      // Fast ASCII whitespace check (Space, Tab, CR, LF)
      const isWhitespace = text.charCodeAt(i) <= 32

      if (isWhitespace) {
        inWord = false
      } else if (!inWord) {
        inWord = true
        wordCount++
      }
    }

    return wordCount
  }

  private static finalizeEstimate(wordCount: number, charCount: number): number {
    const wordBased = Math.ceil(wordCount * this.WORDS_TO_TOKENS_RATIO)
    const charBased = Math.ceil(charCount / this.CHARS_PER_TOKEN_RATIO)

    // Return the more conservative (higher) estimate to avoid context window overflows
    return Math.max(wordBased, charBased)
  }
}
