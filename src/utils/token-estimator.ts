/**
 * Interface representing statistics about the content size.
 */
export interface ContentStats {
  tokenCount: number
}

/**
 * Provides utility methods for estimating token counts.
 */
export class TokenEstimator {
  /**
   * Measures content and provides a token estimate.
   * Uses a whitespace + punctuation heuristic tailored for code.
   * @param text The input string content.
   * @returns A ContentStats object with the estimated token count.
   */
  public static measure(text: string): ContentStats {
    if (!text) {
      return { tokenCount: 0 }
    }

    // Optimization: Split by whitespace to get rough word count.
    // Multiply by 1.3 to account for code punctuation ({, }, ;, etc) which are tokens.
    // Fallback to char/4 if the split results in very few chunks (e.g. minified code).
    const wordCount = text.trim().split(/\s+/).length
    const heuristicCount = Math.ceil(wordCount * 1.3)
    const charHeuristic = Math.ceil(text.length / 4)

    return {
      tokenCount: Math.max(heuristicCount, charHeuristic),
    }
  }

  /**
   * Formats the token count into a human-readable string.
   * @param stats The ContentStats object.
   * @returns A formatted string, e.g., "~1,234 tokens".
   */
  public static format(stats: ContentStats): string {
    return `~${stats.tokenCount.toLocaleString()} tokens`
  }
}
