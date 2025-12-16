import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { StagedFile } from '../../models'
import { ContentFormatter, Logger } from '../../utils'

// High-level suite for ContentFormatter unit tests
suite('ContentFormatter Test Suite', () => {
  // Stubs for dependencies: file system, path utility, and logging
  let readFileStub: sinon.SinonStub
  let relativePathStub: sinon.SinonStub
  let loggerWarnStub: sinon.SinonStub
  let loggerErrorStub: sinon.SinonStub

  // Setup runs before each test
  setup(() => {
    // Mock the private file read operation (accessing disk)
    readFileStub = sinon.stub(ContentFormatter, 'readFileFromDisk')

    // Mock VS Code's relative path conversion for predictable output
    relativePathStub = sinon.stub(vscode.workspace, 'asRelativePath')
    relativePathStub.callsFake((uri: vscode.Uri) => {
      return uri.path.split('/').pop() || 'file'
    })

    // Silence and track Logger calls
    loggerWarnStub = sinon.stub(Logger, 'warn')
    loggerErrorStub = sinon.stub(Logger, 'error')
  })

  // Teardown runs after each test
  teardown(() => {
    // Restore all stubs and mocks
    sinon.restore()
  })

  // Helper function to create a mock StagedFile object
  const createStagedFile = (path: string): StagedFile => {
    const uri = vscode.Uri.file(path)
    return { uri, label: path.split('/').pop() || '' }
  }

  // Test formatting a single text file
  test('format: Should format a standard text file correctly', async () => {
    const file = createStagedFile('/src/test.ts')
    const fileContent = 'console.log("Hello World");'

    // Mock the file read to return valid text content
    readFileStub.resolves(new Uint8Array(Buffer.from(fileContent)))

    const result = await ContentFormatter.format([file])

    // Assert the result follows the expected format: File: <path>\n```<ext>\n<content>\n```
    assert.ok(result.includes('File: test.ts'))
    assert.ok(result.includes('```ts'))
    assert.ok(result.includes(fileContent))
  })

  // Test handling of files identified as binary
  test('format: Should skip binary files', async () => {
    const file = createStagedFile('/src/image.png')

    // Create a buffer with a null byte (0x00), which ContentFormatter detects as binary
    const binaryBuffer = Buffer.alloc(10)
    binaryBuffer[0] = 0x00

    readFileStub.resolves(new Uint8Array(binaryBuffer))

    const result = await ContentFormatter.format([file])

    assert.strictEqual(result, '', 'Binary file content should be empty')
    // Verify that a warning was logged for skipping the file
    assert.ok(loggerWarnStub.calledOnce, 'Logger should warn about binary file')
  })

  // Test graceful failure when disk read throws an error (e.g., permissions, missing file)
  test('format: Should handle file read errors gracefully', async () => {
    const file = createStagedFile('/src/missing.ts')

    // Mock the file read operation to throw an error
    readFileStub.rejects(new Error('File not found'))

    const result = await ContentFormatter.format([file])

    // Assert the result contains the error placeholder format
    assert.ok(result.includes('> Error reading file: missing.ts'))
    // Verify the error was logged
    assert.ok(loggerErrorStub.calledOnce)
  })

  // Test formatting a list of files
  test('format: Should join multiple files with newlines', async () => {
    const file1 = createStagedFile('/a.ts')
    const file2 = createStagedFile('/b.ts')

    // Configure the stub to return different content based on the URI
    readFileStub.withArgs(file1.uri).resolves(new Uint8Array(Buffer.from('File A')))
    readFileStub.withArgs(file2.uri).resolves(new Uint8Array(Buffer.from('File B')))

    const result = await ContentFormatter.format([file1, file2])

    // Check that both file contents are present
    assert.ok(result.includes('File A'))
    assert.ok(result.includes('File B'))
  })
})
