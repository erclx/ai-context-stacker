/**
 * Interface representing statistics about the content size.
 */
export interface ContentStats {
  wordCount: number
  tokenCount: number
}

/**
 * Provides utility methods for estimating token and word counts.
 * Token estimation uses a common heuristic (1 token ≈ 4 characters).
 */
export class TokenEstimator {
  /**
   * Measures content and provides word and token estimates.
   *
   * @param text The input string content.
   * @returns A ContentStats object with estimated counts.
   */
  public static measure(text: string): ContentStats {
    const charCount = text.length

    // Naive word count by splitting on whitespace and filtering out empty strings
    const wordCount = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length

    // Common LLM heuristic: 1 token is approximately 4 characters.
    const tokenCount = Math.ceil(charCount / 4)

    return {
      wordCount,
      tokenCount,
    }
  }

  /**
   * Formats the content statistics into a human-readable string for UI display.
   *
   * @param stats The ContentStats object.
   * @returns A formatted string, e.g., "~1,234 tokens / 3,456 words".
   */
  public static format(stats: ContentStats): string {
    return `~${stats.tokenCount.toLocaleString()} tokens / ${stats.wordCount.toLocaleString()} words`
  }
}
