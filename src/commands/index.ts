import * as vscode from 'vscode'

import { StagedFile } from '@/models'
import { ContextStackProvider, IgnorePatternProvider } from '@/providers'

import { registerAddFileCommand } from './add-file'
import { registerAddFileContextMenuCommand } from './add-file-context-menu'
import { registerAddFilePickerCommand } from './add-file-picker'
import { registerClearAllCommand } from './clear-all'
import { registerCopyAllCommand } from './copy-all'
import { registerCopyFileCommand } from './copy-file'
import { registerRemoveFileCommand } from './remove-file'

interface Providers {
  context: vscode.ExtensionContext
  contextStackProvider: ContextStackProvider
  ignorePatternProvider: IgnorePatternProvider
  treeView: vscode.TreeView<StagedFile>
}

export function registerAllCommands({ context, contextStackProvider, ignorePatternProvider, treeView }: Providers) {
  registerAddFileCommand(context, contextStackProvider)
  registerAddFileContextMenuCommand(context, contextStackProvider, ignorePatternProvider)
  registerAddFilePickerCommand(context, contextStackProvider, ignorePatternProvider)

  registerClearAllCommand(context, contextStackProvider)
  registerCopyAllCommand(context, contextStackProvider)

  registerCopyFileCommand(context, contextStackProvider, treeView)
  registerRemoveFileCommand(context, contextStackProvider, treeView)
}
