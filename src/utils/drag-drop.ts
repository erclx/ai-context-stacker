import * as vscode from 'vscode'

/**
 * Extracts URIs from DataTransfer objects, handling generic text and URI lists.
 */
export async function extractUrisFromTransfer(dataTransfer: vscode.DataTransfer): Promise<vscode.Uri[]> {
  const item = dataTransfer.get('text/uri-list') || dataTransfer.get('text/plain')

  if (!item) return []

  const content = await item.asString()

  // Parse lines, supporting both file:// and vscode-remote:// schemas
  return content
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return l.startsWith('file:') || l.startsWith('vscode-remote:') ? vscode.Uri.parse(l) : vscode.Uri.file(l)
      } catch {
        return null
      }
    })
    .filter((u): u is vscode.Uri => u !== null)
}
