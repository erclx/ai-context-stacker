import * as assert from 'assert'

import { IgnoreParser } from '../../services/ignore-parser'

suite('IgnoreParser Suite', () => {
  test('Should return default security excludes for empty input', () => {
    const result = IgnoreParser.generatePatternString('')

    assert.strictEqual(result, IgnoreParser.DEFAULT_EXCLUDES)
  })

  test('Should transform basic file paths into deep glob patterns', () => {
    const input = 'secret-key.txt'

    const result = IgnoreParser.generatePatternString(input)
    const patterns = parseGlobString(result)

    assert.ok(patterns.includes('**/secret-key.txt'))
  })

  test('Should strip leading and trailing slashes', () => {
    const input = '/build/\n/dist'

    const patterns = parseGlobString(IgnoreParser.generatePatternString(input))

    assert.ok(patterns.includes('**/build'), 'Should strip surrounding slashes from build')
    assert.ok(patterns.includes('**/dist'), 'Should strip leading slash from dist')
  })

  test('Should ignore comments, negations, and whitespace', () => {
    const input = ['# This is a comment', '!important.txt', '   ', 'real-file.ts'].join('\n')

    const patterns = parseGlobString(IgnoreParser.generatePatternString(input))

    assert.ok(patterns.includes('**/real-file.ts'))
    assert.strictEqual(patterns.length, countDefaults() + 1, 'Only one user pattern should be added')
  })

  test('Should deduplicate patterns present in defaults', () => {
    const input = 'package-lock.json'

    const result = IgnoreParser.generatePatternString(input)
    const patterns = parseGlobString(result)

    const matches = patterns.filter((p) => p === '**/package-lock.json')
    assert.strictEqual(matches.length, 1, 'Should not have duplicate entries for default patterns')
  })

  test('Should merge user patterns with defaults', () => {
    const input = 'local-config.json'

    const patterns = parseGlobString(IgnoreParser.generatePatternString(input))

    assert.ok(patterns.includes('**/local-config.json'), 'User pattern must exist')
    assert.ok(patterns.includes('**/node_modules/**'), 'Defaults must still exist')
  })
})

function countDefaults(): number {
  return IgnoreParser.DEFAULT_EXCLUDES.slice(1, -1).split(',').length
}

function parseGlobString(glob: string): string[] {
  if (!glob.startsWith('{') || !glob.endsWith('}')) {
    return [glob]
  }
  return glob.slice(1, -1).split(',')
}
