import * as vscode from 'vscode'

export async function extractUrisFromTransfer(dataTransfer: vscode.DataTransfer): Promise<vscode.Uri[]> {
  const distinctUris = new Map<string, vscode.Uri>()

  for (const [mimeType, item] of dataTransfer) {
    const file = item.asFile()
    if (file?.uri) {
      distinctUris.set(file.uri.toString(), file.uri)
      continue
    }

    if (mimeType === 'text/uri-list') {
      const content = await item.asString()
      parseUriList(content).forEach((uri) => distinctUris.set(uri.toString(), uri))
    }
  }

  return Array.from(distinctUris.values())
}

function parseUriList(content: string): vscode.Uri[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => safeParseUri(line))
    .filter((uri): uri is vscode.Uri => uri !== null)
}

function safeParseUri(line: string): vscode.Uri | null {
  try {
    if (line.startsWith('file:') || line.startsWith('vscode-remote:')) {
      return vscode.Uri.parse(line)
    }
    return vscode.Uri.file(line)
  } catch {
    return null
  }
}
