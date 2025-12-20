import * as assert from 'assert'

import { IgnoreParser } from '../../services/ignore-parser'

/**
 * Validates the transformation of gitignore syntax into VS Code compatible glob patterns.
 * Ensures security defaults are always present and syntax edge cases are handled.
 */
suite('IgnoreParser Suite', () => {
  test('Should return default security excludes for empty input', () => {
    // Act
    const result = IgnoreParser.generatePatternString('')

    // Assert
    assert.strictEqual(result, IgnoreParser.DEFAULT_EXCLUDES)
  })

  test('Should transform basic file paths into deep glob patterns', () => {
    // Arrange
    const input = 'secret-key.txt'

    // Act
    const result = IgnoreParser.generatePatternString(input)
    const patterns = parseGlobString(result)

    // Assert
    assert.ok(patterns.includes('**/secret-key.txt'))
  })

  test('Should strip leading and trailing slashes', () => {
    // Arrange
    const input = '/build/\n/dist'

    // Act
    const patterns = parseGlobString(IgnoreParser.generatePatternString(input))

    // Assert
    assert.ok(patterns.includes('**/build'), 'Should strip surrounding slashes from build')
    assert.ok(patterns.includes('**/dist'), 'Should strip leading slash from dist')
  })

  test('Should ignore comments, negations, and whitespace', () => {
    // Arrange
    const input = [
      '# This is a comment',
      '!important.txt', // Negation not supported in simple findFiles
      '   ', // Whitespace
      'real-file.ts',
    ].join('\n')

    // Act
    const patterns = parseGlobString(IgnoreParser.generatePatternString(input))

    // Assert
    assert.ok(patterns.includes('**/real-file.ts'))
    assert.strictEqual(patterns.length, countDefaults() + 1, 'Only one user pattern should be added')
  })

  test('Should deduplicate patterns present in defaults', () => {
    // Arrange: 'package-lock.json' transforms to '**/package-lock.json', which matches a default
    const input = 'package-lock.json'

    // Act
    const result = IgnoreParser.generatePatternString(input)
    const patterns = parseGlobString(result)

    // Assert
    const matches = patterns.filter((p) => p === '**/package-lock.json')
    assert.strictEqual(matches.length, 1, 'Should not have duplicate entries for default patterns')
  })

  test('Should merge user patterns with defaults', () => {
    // Arrange
    const input = 'local-config.json'

    // Act
    const patterns = parseGlobString(IgnoreParser.generatePatternString(input))

    // Assert
    assert.ok(patterns.includes('**/local-config.json'), 'User pattern must exist')
    assert.ok(patterns.includes('**/node_modules/**'), 'Defaults must still exist')
  })
})

// --- Helpers ---

/**
 * Counts the number of default patterns to verify array lengths.
 */
function countDefaults(): number {
  // Strip curly braces and split
  return IgnoreParser.DEFAULT_EXCLUDES.slice(1, -1).split(',').length
}

/**
 * Utility to unpack the curly-brace glob string back into an array for easier assertion.
 * e.g. "{a,b}" -> ["a", "b"]
 */
function parseGlobString(glob: string): string[] {
  if (!glob.startsWith('{') || !glob.endsWith('}')) {
    return [glob]
  }
  return glob.slice(1, -1).split(',')
}
