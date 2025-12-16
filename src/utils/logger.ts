import * as vscode from 'vscode'

/**
 * Static class for centralized logging to a VS Code Output Channel.
 * Ensures consistent formatting and easy debug access for the user.
 */
export class Logger {
  private static _outputChannel: vscode.OutputChannel

  /**
   * Initializes the logger by creating the dedicated output channel.
   * This must be called once during extension activation.
   *
   * @param name The name for the output channel (e.g., 'Extension Name').
   */
  public static configure(name: string) {
    this._outputChannel = vscode.window.createOutputChannel(name)
  }

  public static info(message: string) {
    this._log('INFO', message)
  }

  public static warn(message: string) {
    this._log('WARN', message)
  }

  /**
   * Logs an error message and handles different error types (Error instance or plain object).
   * Also ensures the output channel is shown to the user immediately on error.
   *
   * @param message The main error message.
   * @param error The error object, if available.
   */
  public static error(message: string, error?: any) {
    this._log('ERROR', message)
    if (error) {
      if (error instanceof Error) {
        // Log stack trace if available, otherwise just the message
        this._log('ERROR', error.stack || error.message)
      } else {
        // Handle non-Error objects gracefully
        this._log('ERROR', JSON.stringify(error))
      }
    }
    this.show()
  }

  public static show() {
    // Optional chaining because it might be called before configure, though unlikely in practice
    this._outputChannel?.show(true)
  }

  /**
   * Disposes of the underlying OutputChannel to clean up resources on deactivation.
   */
  public static dispose() {
    this._outputChannel?.dispose()
  }

  /**
   * Internal method for logging with timestamp and level prefix.
   */
  private static _log(level: string, message: string) {
    // Bail out if channel was not configured (or was disposed)
    if (!this._outputChannel) {
      return
    }
    const timestamp = new Date().toLocaleTimeString()
    this._outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`)
  }
}
