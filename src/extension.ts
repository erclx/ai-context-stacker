import * as vscode from 'vscode'

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('vscode-extension-template.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from VSCode Extension Template!')
  })

  context.subscriptions.push(disposable)
}

export function deactivate() {}
