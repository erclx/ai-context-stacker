import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { ContextStackProvider, IgnorePatternProvider } from '../providers'
import { registerAddFileCommand } from './add-file'
import { registerAddFileContextMenuCommand } from './add-file-context-menu'
import { registerAddFilePickerCommand } from './add-file-picker'
import { registerAddOpenFilesCommand } from './add-open-files'
import { registerClearAllCommand } from './clear-all'
import { registerCopyAllCommand } from './copy-all'
import { registerCopyFileCommand } from './copy-file'
import { registerRemoveFileCommand } from './remove-file'

/**
 * Defines the dependencies required by command registration functions.
 */
interface Providers {
  context: vscode.ExtensionContext
  contextStackProvider: ContextStackProvider
  ignorePatternProvider: IgnorePatternProvider
  // The TreeView instance is required by file-specific commands to resolve selection
  treeView: vscode.TreeView<StagedFile>
}

/**
 * Registers all commands exposed by the extension.
 * This function serves as the central command registration entry point.
 *
 * @param {Providers} dependencies The necessary providers and context.
 */
export function registerAllCommands({ context, contextStackProvider, ignorePatternProvider, treeView }: Providers) {
  registerAddFileCommand(context, contextStackProvider)
  registerAddFileContextMenuCommand(context, contextStackProvider, ignorePatternProvider)
  registerAddFilePickerCommand(context, contextStackProvider, ignorePatternProvider)
  registerAddOpenFilesCommand(context, contextStackProvider)

  registerClearAllCommand(context, contextStackProvider)
  registerCopyAllCommand(context, contextStackProvider)

  // These commands operate on specific files selected in the TreeView
  registerCopyFileCommand(context, contextStackProvider, treeView)
  registerRemoveFileCommand(context, contextStackProvider, treeView)
}
