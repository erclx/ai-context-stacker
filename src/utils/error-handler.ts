import * as vscode from 'vscode'

import { Logger } from './logger'

export class ErrorHandler {
  public static safeExecute<T>(commandName: string, action: () => Promise<T>): () => Promise<T | void> {
    return async () => {
      try {
        return await action()
      } catch (error: unknown) {
        this.logAndNotify(commandName, error)
      }
    }
  }

  public static handle(error: unknown, context: string): void {
    this.logAndNotify(context, error)
  }

  private static logAndNotify(context: string, error: unknown): void {
    if (error instanceof vscode.CancellationError) {
      Logger.info(`Command canceled: ${context}`)
      return
    }

    Logger.error(`Command failed: ${context}`, error, true)
  }
}
