import * as vscode from 'vscode'

import { Logger } from './logger'

/**
 * Standardizes error handling for extension commands.
 * Ensures no command fails silently and errors are logged consistently.
 */
export class ErrorHandler {
  /**
   * Wraps an async command function with a standard try-catch block.
   * @param commandName - Identifier for the command being executed
   * @param action - The async operation to execute
   */
  public static safeExecute<T>(commandName: string, action: () => Promise<T>): () => Promise<T | void> {
    return async () => {
      try {
        return await action()
      } catch (error: unknown) {
        this.logAndNotify(commandName, error)
      }
    }
  }

  /**
   * Helper to handle errors in "fire-and-forget" scenarios.
   */
  public static handle(error: unknown, context: string): void {
    this.logAndNotify(context, error)
  }

  private static logAndNotify(context: string, error: unknown): void {
    // Don't alert the user if they simply canceled an input box or picker
    if (error instanceof vscode.CancellationError) {
      Logger.info(`Command canceled: ${context}`)
      return
    }

    Logger.error(`Command failed: ${context}`, error, true)
  }
}
