import * as vscode from 'vscode'

/**
 * Extracts URIs from DataTransfer objects, handling both direct File objects (OS)
 * and URI lists (Internal VS Code).
 *
 * @returns Unique array of valid VS Code URIs.
 */
export async function extractUrisFromTransfer(dataTransfer: vscode.DataTransfer): Promise<vscode.Uri[]> {
  const distinctUris = new Map<string, vscode.Uri>()

  // Iterate over all entries to catch both 'text/uri-list' and file objects
  for (const [mimeType, item] of dataTransfer) {
    // 1. Handle actual File objects (e.g., dragged from OS Explorer/Finder)
    const file = item.asFile()
    if (file && file.uri) {
      distinctUris.set(file.uri.toString(), file.uri)
      continue
    }

    // 2. Handle URI lists (e.g., dragged from VS Code Explorer)
    if (mimeType === 'text/uri-list') {
      const content = await item.asString()
      const uris = parseUriList(content)
      uris.forEach((uri) => distinctUris.set(uri.toString(), uri))
    }
  }

  return Array.from(distinctUris.values())
}

/**
 * Parses standard URI-list content (newline separated).
 */
function parseUriList(content: string): vscode.Uri[] {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        // Handle standard file URIs and remote schemes
        return line.startsWith('file:') || line.startsWith('vscode-remote:')
          ? vscode.Uri.parse(line)
          : vscode.Uri.file(line)
      } catch {
        return null
      }
    })
    .filter((uri): uri is vscode.Uri => uri !== null)
}
