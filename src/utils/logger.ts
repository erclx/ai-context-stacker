import * as vscode from 'vscode'

export class Logger {
  private static _outputChannel: vscode.OutputChannel

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
   * Logs an error and optionally notifies the user via a UI message.
   * @param message Technical log message
   * @param error The original error object
   * @param notifyUser If true, shows a sanitized error message to the user
   */
  public static error(message: string, error?: any, notifyUser = false) {
    this._log('ERROR', message)

    if (error) {
      if (error instanceof Error) {
        this._log('ERROR', error.stack || error.message)
      } else {
        this._log('ERROR', JSON.stringify(error))
      }
    }

    if (notifyUser) {
      const userMessage = `AI Context Stacker: ${message}`
      vscode.window.showErrorMessage(userMessage, 'Show Log').then((selection) => {
        if (selection === 'Show Log') {
          this.show()
        }
      })
    }
  }

  public static show() {
    this._outputChannel?.show(true)
  }

  public static dispose() {
    this._outputChannel?.dispose()
  }

  private static _log(level: string, message: string) {
    if (!this._outputChannel) return
    const timestamp = new Date().toLocaleTimeString()
    this._outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`)
  }
}
