import * as vscode from 'vscode'

import { ContextTrack, StackTreeItem } from '../models'
import { ContextStackProvider, ContextTrackManager, IgnorePatternProvider } from '../providers'
import { registerAddFileCommand } from './add-file'
import { registerAddFileContextMenuCommand } from './add-file-context-menu'
import { registerAddFilePickerCommand } from './add-file-picker'
import { registerAddOpenFilesCommand } from './add-open-files'
import { registerClearAllCommand } from './clear-all'
import { registerCopyAllCommand } from './copy-all'
import { registerCopyFileCommand } from './copy-file'
import { registerPreviewContextCommand } from './preview-context'
import { registerRemoveFileCommand } from './remove-file'
import { registerTogglePinCommand } from './toggle-pin'
import { registerTrackCommands } from './track-ops'

interface Providers {
  extensionContext: vscode.ExtensionContext
  contextStackProvider: ContextStackProvider
  ignorePatternProvider: IgnorePatternProvider
  filesView: vscode.TreeView<StackTreeItem>
  contextTrackManager: ContextTrackManager
  tracksView: vscode.TreeView<ContextTrack>
}

export function registerAllCommands(deps: Providers) {
  registerAddFileCommand(deps.extensionContext, deps.contextStackProvider)
  registerAddFileContextMenuCommand(deps.extensionContext, deps.contextStackProvider, deps.ignorePatternProvider)
  registerAddFilePickerCommand(deps.extensionContext, deps.contextStackProvider, deps.ignorePatternProvider)
  registerAddOpenFilesCommand(deps.extensionContext, deps.contextStackProvider)

  registerTogglePinCommand(deps.extensionContext, deps.contextTrackManager, deps.filesView)

  registerPreviewContextCommand(deps.extensionContext, deps.contextStackProvider)

  registerClearAllCommand(deps.extensionContext, deps.contextStackProvider)
  registerCopyAllCommand(deps.extensionContext, deps.contextStackProvider)
  registerCopyFileCommand(deps.extensionContext, deps.contextStackProvider, deps.filesView)
  registerRemoveFileCommand(deps.extensionContext, deps.contextStackProvider, deps.filesView)

  registerTrackCommands(deps.extensionContext, deps.contextTrackManager, deps.tracksView)
}
