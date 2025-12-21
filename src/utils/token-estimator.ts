/**
 * Standalone interface to prevent circular dependencies with Models.
 */
export interface SimpleStats {
  tokenCount: number
  charCount: number
}

/**
 * Provides high-performance token estimation for VS Code editor contexts.
 * Uses a hybrid approach: iterative scanning for accuracy on small files
 * and O(1) character-based heuristics for large files to maintain UI fluidity.
 */
export class TokenEstimator {
  // 100KB limit prevents event-loop blocking during real-time typing/selection
  private static readonly LARGE_FILE_THRESHOLD = 100 * 1024
  private static readonly CHARS_PER_TOKEN_RATIO = 4
  private static readonly WORDS_TO_TOKENS_RATIO = 1.3

  /**
   * Estimates token count for a given string.
   * @param text - The raw content to analyze
   * @returns Object containing token and character metrics
   */
  public static measure(text: string): SimpleStats {
    // Guard against null/undefined or empty inputs from external API calls
    if (typeof text !== 'string' || !text) {
      return { tokenCount: 0, charCount: 0 }
    }

    const charCount = text.length
    const tokenCount = this.determineTokenCount(text, charCount)

    return { tokenCount, charCount }
  }

  /**
   * Formats stats into a user-friendly string for Status Bars or Tooltips.
   */
  public static format(stats: SimpleStats): string {
    return `~${stats.tokenCount.toLocaleString()} tokens`
  }

  /**
   * Routes the counting logic based on file size to preserve responsiveness.
   */
  private static determineTokenCount(text: string, charCount: number): number {
    if (charCount > this.LARGE_FILE_THRESHOLD) {
      return Math.ceil(charCount / this.CHARS_PER_TOKEN_RATIO)
    }

    const wordCount = this.countWordsIterative(text, charCount)
    return this.applyTokenHeuristics(wordCount, charCount)
  }

  /**
   * State-machine scanner to avoid the GC pressure of split() and regex.
   * O(N) time complexity with O(1) memory overhead.
   */
  private static countWordsIterative(text: string, charCount: number): number {
    let wordCount = 0
    let inWord = false

    for (let i = 0; i < charCount; i++) {
      const code = text.charCodeAt(i)

      // Treat standard control chars and space as delimiters
      const isWhitespace = code <= 32

      if (isWhitespace) {
        inWord = false
      } else if (!inWord) {
        inWord = true
        wordCount++
      }
    }

    return wordCount
  }

  /**
   * Adjusts word count based on typical LLM tokenization patterns.
   */
  private static applyTokenHeuristics(wordCount: number, charCount: number): number {
    // Tokens often break on sub-words/punctuation, increasing the count relative to words
    const estimatedByWords = Math.ceil(wordCount * this.WORDS_TO_TOKENS_RATIO)

    // Ensure dense code (minified) doesn't result in an under-estimation
    const estimatedByChars = Math.ceil(charCount / this.CHARS_PER_TOKEN_RATIO)

    return Math.max(estimatedByWords, estimatedByChars)
  }
}
