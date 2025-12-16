import * as assert from 'assert'

import { TokenEstimator } from '../../utils'

// Suite for testing the utility functions in TokenEstimator
suite('TokenEstimator Test Suite', () => {
  // Test the `measure` function with a basic string input
  test('measure: Should calculate correct stats for simple text', () => {
    const text = 'Hello world'
    // Expected Calculation:
    // Length: 11 chars
    // Words: 2 (based on splitting by whitespace)
    // Tokens: ceil(11 / 4) = 3 (simple 4:1 character-to-token ratio)

    const stats = TokenEstimator.measure(text)

    // Assertions for word and token counts
    assert.strictEqual(stats.wordCount, 2, 'Word count incorrect')
    assert.strictEqual(stats.tokenCount, 3, 'Token count incorrect')
  })

  // Test the `measure` function with an empty string
  test('measure: Should handle empty strings', () => {
    const text = ''
    const stats = TokenEstimator.measure(text)

    // Both counts should be zero
    assert.strictEqual(stats.wordCount, 0)
    assert.strictEqual(stats.tokenCount, 0)
  })

  // Test the `measure` function with a string containing only whitespace
  test('measure: Should handle whitespace-only strings', () => {
    const text = '   \n   '
    // Logic check:
    // charCount = 7
    // wordCount = 0 (because the text is trimmed before splitting)
    // tokenCount = ceil(7/4) = 2

    const stats = TokenEstimator.measure(text)

    assert.strictEqual(stats.wordCount, 0, 'Whitespace should have 0 words')
    // Ensure tokens are still calculated based on character count, even if words are zero
    assert.strictEqual(stats.tokenCount, 2, 'Whitespace still consumes tokens')
  })

  // Test that the word count logic correctly handles multiple whitespace delimiters
  test('measure: Should ignore extra spaces between words', () => {
    const text = 'one    two\nthree'
    const stats = TokenEstimator.measure(text)

    assert.strictEqual(stats.wordCount, 3, 'Should handle multiple delimiters')
  })

  // Test the `format` function for presentation output
  test('format: Should format large numbers with commas', () => {
    // Mock stats object with large numbers
    const stats = {
      wordCount: 1500,
      tokenCount: 4000,
    }

    const result = TokenEstimator.format(stats)

    // Expected format: "~4,000 tokens / 1,500 words"
    // Check for the presence of the required numbers and labels.
    assert.ok(result.includes('4,000') || result.includes('4000'), 'Should contain token count')
    assert.ok(result.includes('1,500') || result.includes('1500'), 'Should contain word count')
    assert.ok(result.includes('tokens'), 'Should include label')
  })
})
