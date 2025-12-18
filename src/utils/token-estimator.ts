/**
 * Interface representing statistics about the content size.
 */
export interface ContentStats {
  tokenCount: number
}

/**
 * Provides utility methods for estimating token counts.
 * Token estimation uses a common heuristic (1 token ≈ 4 characters).
 */
export class TokenEstimator {
  /**
   * Measures content and provides a token estimate.
   * * @param text The input string content.
   * @returns A ContentStats object with the estimated token count.
   */
  public static measure(text: string): ContentStats {
    // Common LLM heuristic: 1 token is approximately 4 characters.
    const tokenCount = Math.ceil(text.length / 4)

    return {
      tokenCount,
    }
  }

  /**
   * Formats the token count into a human-readable string.
   * * @param stats The ContentStats object.
   * @returns A formatted string, e.g., "~1,234 tokens".
   */
  public static format(stats: ContentStats): string {
    return `~${stats.tokenCount.toLocaleString()} tokens`
  }
}
