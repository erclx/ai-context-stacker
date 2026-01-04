import * as assert from 'assert'
import * as vscode from 'vscode'

import { ServiceRegistry } from '../services'

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.')

  const EXTENSION_ID = 'erclx.ai-context-stacker'

  test('Smoke Test: Add Current File to Context', async () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID)
    assert.ok(extension, 'Extension not found')

    const services = (await extension.activate()) as ServiceRegistry
    assert.ok(services, 'Services not returned from activate')

    const workspaceFolders = vscode.workspace.workspaceFolders

    if (!workspaceFolders) return

    const rootPath = workspaceFolders[0].uri
    const testFileUri = vscode.Uri.joinPath(rootPath, 'smoke-test.txt')

    await vscode.workspace.fs.writeFile(testFileUri, Buffer.from('Smoke Test Content'))

    const document = await vscode.workspace.openTextDocument(testFileUri)
    await vscode.window.showTextDocument(document)

    try {
      await vscode.commands.executeCommand('aiContextStacker.addCurrentFile')

      const stagedFiles = services.stackProvider.getFiles()
      const isStaged = stagedFiles.some((f) => f.uri.fsPath === testFileUri.fsPath)

      assert.strictEqual(isStaged, true, 'File was not added to the context stack')
    } finally {
      try {
        await vscode.workspace.fs.delete(testFileUri)
      } catch {}

      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  })
})
