import * as vscode from 'vscode'

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export class Logger {
  private static _outputChannel: vscode.OutputChannel | undefined
  private static _logLevel: LogLevel = 'INFO'

  public static configure(name: string, level: LogLevel = 'INFO'): void {
    this._outputChannel?.dispose()
    this._outputChannel = vscode.window.createOutputChannel(name)
    this._logLevel = level
  }

  public static setLevel(level: LogLevel): void {
    this._logLevel = level
  }

  public static debug(message: string): void {
    if (this.shouldLog('DEBUG')) {
      this.log('DEBUG', message)
    }
  }

  public static info(message: string): void {
    if (this.shouldLog('INFO')) {
      this.log('INFO', message)
    }
  }

  public static warn(message: string): void {
    if (this.shouldLog('WARN')) {
      this.log('WARN', message)
    }
  }

  public static error(message: string, error?: unknown, notifyUser = false): void {
    if (this.shouldLog('ERROR')) {
      this.log('ERROR', message)

      if (error) {
        this.logErrorDetails(error)
      }
    }

    if (notifyUser) {
      this.notifyUser(message)
    }
  }

  public static show(): void {
    this._outputChannel?.show(true)
  }

  public static dispose(): void {
    this._outputChannel?.dispose()
  }

  private static shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR']
    const currentIdx = levels.indexOf(this._logLevel)
    const targetIdx = levels.indexOf(level)
    return targetIdx >= currentIdx
  }

  private static logErrorDetails(error: unknown): void {
    if (error instanceof Error) {
      this.log('ERROR', error.stack || error.message)
      return
    }
    this.log('ERROR', String(error))
  }

  private static notifyUser(message: string): void {
    const userMessage = `AI Context Stacker: ${message}`

    void vscode.window.showErrorMessage(userMessage, 'Show Log').then((selection) => {
      if (selection === 'Show Log') {
        this.show()
      }
    })
  }

  private static log(level: string, message: string): void {
    if (!this._outputChannel) return

    const timestamp = new Date().toLocaleTimeString()
    this._outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`)
  }
}
