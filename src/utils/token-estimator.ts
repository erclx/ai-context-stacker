import { ContentStats } from '../models'

export class TokenEstimator {
  private static readonly LARGE_FILE_THRESHOLD = 100 * 1024
  private static readonly CHARS_PER_TOKEN_RATIO = 4
  private static readonly WORDS_TO_TOKENS_RATIO = 1.3

  public static measure(text: string): ContentStats {
    if (!text) {
      return { tokenCount: 0, charCount: 0 }
    }

    const charCount = text.length
    const tokenCount = this.computeTokenCount(text, charCount)

    return { tokenCount, charCount }
  }

  public static format(stats: ContentStats): string {
    return `~${stats.tokenCount.toLocaleString()} tokens`
  }

  private static computeTokenCount(text: string, charCount: number): number {
    if (charCount > this.LARGE_FILE_THRESHOLD) {
      return Math.ceil(charCount / this.CHARS_PER_TOKEN_RATIO)
    }

    const wordCount = this.countWordsIterative(text, charCount)
    return this.finalizeEstimate(wordCount, charCount)
  }

  private static countWordsIterative(text: string, length: number): number {
    let wordCount = 0
    let inWord = false

    for (let i = 0; i < length; i++) {
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

    return Math.max(wordBased, charBased)
  }
}
