import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { ContextStackProvider, ContextTrackManager, IgnorePatternProvider } from '../providers'
import { registerAddFileCommand } from './add-file'
import { registerAddFileContextMenuCommand } from './add-file-context-menu'
import { registerAddFilePickerCommand } from './add-file-picker'
import { registerAddOpenFilesCommand } from './add-open-files'
import { registerClearAllCommand } from './clear-all'
import { registerCopyAllCommand } from './copy-all'
import { registerCopyFileCommand } from './copy-file'
import { registerRemoveFileCommand } from './remove-file'
import { registerTrackCommands } from './track-ops'

interface Providers {
  context: vscode.ExtensionContext
  contextStackProvider: ContextStackProvider
  ignorePatternProvider: IgnorePatternProvider
  treeView: vscode.TreeView<StagedFile>
  trackManager: ContextTrackManager
}

export function registerAllCommands(deps: Providers) {
  // File Operations
  registerAddFileCommand(deps.context, deps.contextStackProvider)
  registerAddFileContextMenuCommand(deps.context, deps.contextStackProvider, deps.ignorePatternProvider)
  registerAddFilePickerCommand(deps.context, deps.contextStackProvider, deps.ignorePatternProvider)
  registerAddOpenFilesCommand(deps.context, deps.contextStackProvider)

  registerClearAllCommand(deps.context, deps.contextStackProvider)
  registerCopyAllCommand(deps.context, deps.contextStackProvider)
  registerCopyFileCommand(deps.context, deps.contextStackProvider, deps.treeView)
  registerRemoveFileCommand(deps.context, deps.contextStackProvider, deps.treeView)

  // Track Operations (New)
  registerTrackCommands(deps.context, deps.trackManager)
}
