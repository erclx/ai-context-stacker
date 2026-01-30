import * as assert from 'assert'

export function normalizePath(pathStr: string): string {
  let res = pathStr

  res = res.replace(/\\/g, '/')

  if (process.platform === 'darwin' && res.startsWith('/private/var')) {
    res = '/var' + res.slice(8)
  }

  if (process.platform === 'darwin' || process.platform === 'win32') {
    res = res.toLowerCase()
  }

  return res
}

export function assertPathEqual(actual: string, expected: string, message?: string): void {
  assert.strictEqual(normalizePath(actual), normalizePath(expected), message)
}
