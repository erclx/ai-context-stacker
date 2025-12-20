import * as vscode from 'vscode'

import { ContextTrack, StagedFile } from '../models'
import { ContextStackProvider, ContextTrackManager, IgnorePatternProvider } from '../providers'
import { registerAddFileCommand } from './add-file'
import { registerAddFileContextMenuCommand } from './add-file-context-menu'
import { registerAddFilePickerCommand } from './add-file-picker'
import { registerAddOpenFilesCommand } from './add-open-files'
import { registerClearAllCommand } from './clear-all'
import { registerCopyAllCommand } from './copy-all'
import { registerCopyFileCommand } from './copy-file'
import { registerRemoveFileCommand } from './remove-file'
import { registerTogglePinCommand } from './toggle-pin'
import { registerTrackCommands } from './track-ops'

interface Providers {
  context: vscode.ExtensionContext
  contextStackProvider: ContextStackProvider
  ignorePatternProvider: IgnorePatternProvider
  filesView: vscode.TreeView<StagedFile>
  trackManager: ContextTrackManager
  tracksView: vscode.TreeView<ContextTrack>
}

export function registerAllCommands(deps: Providers) {
  // File Operations
  registerAddFileCommand(deps.context, deps.contextStackProvider)
  registerAddFileContextMenuCommand(deps.context, deps.contextStackProvider, deps.ignorePatternProvider)
  registerAddFilePickerCommand(deps.context, deps.contextStackProvider, deps.ignorePatternProvider)
  registerAddOpenFilesCommand(deps.context, deps.contextStackProvider)
  registerTogglePinCommand(deps.context, deps.trackManager)

  registerClearAllCommand(deps.context, deps.contextStackProvider)
  registerCopyAllCommand(deps.context, deps.contextStackProvider)
  registerCopyFileCommand(deps.context, deps.contextStackProvider, deps.filesView)
  registerRemoveFileCommand(deps.context, deps.contextStackProvider, deps.filesView)

  // Track Operations
  registerTrackCommands(deps.context, deps.trackManager, deps.tracksView)
}
