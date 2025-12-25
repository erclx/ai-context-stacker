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
    if (file?.uri) {
      distinctUris.set(file.uri.toString(), file.uri)
      continue
    }

    // 2. Handle URI lists (e.g., dragged from VS Code Explorer)
    if (mimeType === 'text/uri-list') {
      const content = await item.asString()
      parseUriList(content).forEach((uri) => distinctUris.set(uri.toString(), uri))
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
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => safeParseUri(line))
    .filter((uri): uri is vscode.Uri => uri !== null)
}

function safeParseUri(line: string): vscode.Uri | null {
  try {
    // Handle standard file URIs and remote schemes
    if (line.startsWith('file:') || line.startsWith('vscode-remote:')) {
      return vscode.Uri.parse(line)
    }
    // Fallback for raw paths
    return vscode.Uri.file(line)
  } catch {
    return null
  }
}
