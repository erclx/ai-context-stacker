import * as vscode from 'vscode'

/**
 * A simple TreeDataProvider that displays static help/instruction items
 * in a dedicated view within the extension.
 */
export class HelpProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element
  }

  /**
   * Defines the static list of instructions for the help view.
   *
   * @returns An array of VS Code TreeItems.
   */
  getChildren(): vscode.TreeItem[] {
    const items = [
      // Added instruction for "Add All Open Files"
      this.createItem('Add all currently open files to stack', 'editor-layout'),
      this.createItem('Click "Add File" to add files to stack', 'add'),
      this.createItem('Click "Copy All" to grab context', 'copy'),
      this.createItem('Clear stack to start over', 'clear-all'),
    ]
    return items
  }

  /**
   * Helper to create a TreeItem with a theme icon.
   */
  private createItem(label: string, iconName: string): vscode.TreeItem {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None)
    // Use ThemeIcon for high-quality, scalable icons integrated with the VS Code theme
    item.iconPath = new vscode.ThemeIcon(iconName)
    return item
  }
}
