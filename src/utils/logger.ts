import * as vscode from 'vscode'

/**
 * Centralized logging to VS Code Output Channel.
 */
export class Logger {
  private static _outputChannel: vscode.OutputChannel

  /**
   * Must be called once during extension activation.
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
   * Logs error and automatically shows output channel.
   */
  public static error(message: string, error?: any) {
    this._log('ERROR', message)
    if (error) {
      if (error instanceof Error) {
        this._log('ERROR', error.stack || error.message)
      } else {
        this._log('ERROR', JSON.stringify(error))
      }
    }
    this.show()
  }

  public static show() {
    this._outputChannel?.show(true)
  }

  public static dispose() {
    this._outputChannel?.dispose()
  }

  private static _log(level: string, message: string) {
    if (!this._outputChannel) {
      return
    }
    const timestamp = new Date().toLocaleTimeString()
    this._outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`)
  }
}
