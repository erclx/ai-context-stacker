import * as vscode from 'vscode'

export class Logger {
  private static _outputChannel: vscode.OutputChannel | undefined

  public static configure(name: string): void {
    this._outputChannel?.dispose()
    this._outputChannel = vscode.window.createOutputChannel(name)
  }

  public static info(message: string): void {
    this.log('INFO', message)
  }

  public static warn(message: string): void {
    this.log('WARN', message)
  }

  public static error(message: string, error?: unknown, notifyUser = false): void {
    this.log('ERROR', message)

    if (error) {
      this.logErrorDetails(error)
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
