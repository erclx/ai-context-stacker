import * as vscode from 'vscode'

export function registerSelectAllCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand('aiContextStacker.selectAll', async () => {
    await vscode.commands.executeCommand('list.selectAll')
  })

  context.subscriptions.push(command)
}
