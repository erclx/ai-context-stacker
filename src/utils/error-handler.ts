import * as vscode from 'vscode'

import { Logger } from './logger'

/**
 * Standardizes error handling for extension commands.
 * Ensures no command fails silently and errors are logged consistently.
 */
export class ErrorHandler {
  /**
   * Wraps an async command function with a standard try-catch block.
   * - Logs errors automatically.
   * - Shows a user-friendly error message.
   * - Ignores "Canceled" errors (e.g., user closing a QuickPick).
   */
  public static safeExecute<T>(commandName: string, action: () => Promise<T>): () => Promise<T | void> {
    return async () => {
      try {
        return await action()
      } catch (error: any) {
        if (error instanceof vscode.CancellationError) {
          Logger.info(`Command canceled: ${commandName}`)
          return
        }

        const message = error.message || 'Unknown error occurred'
        Logger.error(`Command failed: ${commandName}`, error, true)
      }
    }
  }

  /**
   * Helper to handle errors in "fire-and-forget" scenarios (e.g., event listeners).
   */
  public static handle(error: unknown, context: string) {
    if (error instanceof vscode.CancellationError) return
    Logger.error(`Error in ${context}`, error, true)
  }
}
