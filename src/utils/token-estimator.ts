export interface ContentStats {
  wordCount: number
  tokenCount: number
}

export class TokenEstimator {
  public static measure(text: string): ContentStats {
    const charCount = text.length

    const wordCount = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length

    const tokenCount = Math.ceil(charCount / 4)

    return {
      wordCount,
      tokenCount,
    }
  }

  public static format(stats: ContentStats): string {
    return `~${stats.tokenCount.toLocaleString()} tokens / ${stats.wordCount.toLocaleString()} words`
  }
}
