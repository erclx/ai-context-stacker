/**
 * Standalone interface to prevent circular dependencies with Models.
 */
export interface SimpleStats {
  tokenCount: number
  charCount: number
}

export class TokenEstimator {
  private static readonly LARGE_FILE_THRESHOLD = 100 * 1024 // 100KB

  /**
   * Estimates token count. Uses a precise split strategy for small files
   * and a fast character heuristic for large files to prevent UI freezes.
   */
  public static measure(text: string): SimpleStats {
    if (!text) {
      return { tokenCount: 0, charCount: 0 }
    }

    const charCount = text.length
    let tokenCount: number

    if (charCount > this.LARGE_FILE_THRESHOLD) {
      // Fast heuristic for large files (approx 4 chars per token)
      tokenCount = Math.ceil(charCount / 4)
    } else {
      // More accurate split-based heuristic for smaller files
      const wordCount = text.trim().split(/\s+/).length
      const heuristic = Math.ceil(wordCount * 1.3)
      const charFallback = Math.ceil(charCount / 4)
      tokenCount = Math.max(heuristic, charFallback)
    }

    return { tokenCount, charCount }
  }

  public static format(stats: SimpleStats): string {
    return `~${stats.tokenCount.toLocaleString()} tokens`
  }
}
