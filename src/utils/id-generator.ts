/**
 * Generates a unique, timestamp-based ID with a specified prefix.
 * Format: {prefix}_{timestamp}_{random}
 */
export function generateId(prefix = 'id'): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 7)
  return `${prefix}_${timestamp}_${random}`
}
