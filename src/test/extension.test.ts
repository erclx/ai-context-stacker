import * as assert from 'assert'
import * as vscode from 'vscode'

// Import types for type-casting the extension API
import { ServiceRegistry } from '../services'

// Main test suite for verifying extension integration and functionality
suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.')

  // Extension identifier must match the publisher.name in package.json
  const EXTENSION_ID = 'erclx.ai-context-stacker'

  // Smoke test to verify that the "Add Current File" command updates internal state
  test('Smoke Test: Add Current File to Context', async () => {
    // Retrieve the installed extension instance
    const extension = vscode.extensions.getExtension(EXTENSION_ID)
    assert.ok(extension, 'Extension not found')

    // Activate extension and expose internal services for verification
    const services = (await extension.activate()) as ServiceRegistry
    assert.ok(services, 'Services not returned from activate')

    // Get the root URI of the current workspace
    const workspaceFolders = vscode.workspace.workspaceFolders

    // Abort the test if no workspace is open
    if (!workspaceFolders) return

    const rootPath = workspaceFolders[0].uri
    const testFileUri = vscode.Uri.joinPath(rootPath, 'smoke-test.txt')

    // Create a temporary file to simulate user activity
    await vscode.workspace.fs.writeFile(testFileUri, Buffer.from('Smoke Test Content'))

    // Open the text document in the active editor
    const document = await vscode.workspace.openTextDocument(testFileUri)
    await vscode.window.showTextDocument(document)

    try {
      // Trigger the command to add the active file to context
      await vscode.commands.executeCommand('aiContextStacker.addCurrentFile')

      // Query the internal provider to verify the file was added
      const stagedFiles = services.contextStackProvider.getFiles()
      const isStaged = stagedFiles.some((f) => f.uri.fsPath === testFileUri.fsPath)

      // Assert that the file exists in the context stack
      assert.strictEqual(isStaged, true, 'File was not added to the context stack')
    } finally {
      // Clean up the temporary file to avoid test pollution
      await vscode.workspace.fs.delete(testFileUri)
    }
  })
})
