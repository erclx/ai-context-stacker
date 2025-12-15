import * as vscode from 'vscode'

export class HelpProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element
  }

  getChildren(): vscode.TreeItem[] {
    const items = [
      this.createItem('Click "Add File" to add files to stack', 'add'),
      this.createItem('Click "Copy All" to grab context', 'copy'),
      this.createItem('Clear stack to start over', 'clear-all'),
    ]
    return items
  }

  private createItem(label: string, iconName: string): vscode.TreeItem {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None)
    item.iconPath = new vscode.ThemeIcon(iconName)
    return item
  }
}
