import * as vscode from 'vscode'

export class Logger {
  private static _outputChannel: vscode.OutputChannel | undefined

  public static configure(name: string): void {
    this._outputChannel = vscode.window.createOutputChannel(name)
  }

  public static info(message: string): void {
    this._log('INFO', message)
  }

  public static warn(message: string): void {
    this._log('WARN', message)
  }

  /**
   * Logs an error and optionally notifies the user via a UI message.
   * @param message - Technical log message
   * @param error - The original error object
   * @param notifyUser - If true, shows a sanitized error message to the user
   */
  public static error(message: string, error?: unknown, notifyUser = false): void {
    this._log('ERROR', message)

    if (error) {
      this._logErrorDetails(error)
    }

    if (notifyUser) {
      this._notifyUser(message)
    }
  }

  public static show(): void {
    this._outputChannel?.show(true)
  }

  public static dispose(): void {
    this._outputChannel?.dispose()
  }

  private static _logErrorDetails(error: unknown): void {
    if (error instanceof Error) {
      this._log('ERROR', error.stack || error.message)
    } else {
      this._log('ERROR', JSON.stringify(error))
    }
  }

  private static _notifyUser(message: string): void {
    const userMessage = `AI Context Stacker: ${message}`

    // Explicitly ignore promise (fire-and-forget) to satisfy strict linting
    void vscode.window.showErrorMessage(userMessage, 'Show Log').then((selection) => {
      if (selection === 'Show Log') {
        this.show()
      }
    })
  }

  private static _log(level: string, message: string): void {
    if (!this._outputChannel) return

    const timestamp = new Date().toLocaleTimeString()
    this._outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`)
  }
}
