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

  public static error(message: string, error?: any) {
    this._log('ERROR', message)
    if (error) {
      if (error instanceof Error) {
        this._log('ERROR', error.stack || error.message)
      } else {
        this._log('ERROR', JSON.stringify(error))
      }
    }
    this.show() // Automatically show the logs on error
  }

  public static show() {
    this._outputChannel?.show(true) // true = preserves focus on editor
  }

  public static dispose() {
    this._outputChannel?.dispose()
  }

  private static _log(level: string, message: string) {
    if (!this._outputChannel) {
      // Prevent crash if Logger is used before initialization
      return
    }
    const timestamp = new Date().toLocaleTimeString()
    this._outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`)
  }
}
