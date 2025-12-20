/**
 * Generates a unique, timestamp-based ID with a specified prefix.
 * Format: {prefix}_{timestamp}_{random}
 */
export function generateId(prefix: string = 'id'): string {
  // .substring(2, 7) grabs 5 characters starting after "0."
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
}
