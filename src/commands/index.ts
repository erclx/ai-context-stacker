import * as vscode from 'vscode'

import { ServiceRegistry } from '../services'
import { ViewManager } from '../ui'
import { registerAddFileCommand } from './add-file'
import { registerAddFileContextMenuCommand } from './add-file-context-menu'
import { registerAddFilePickerCommand } from './add-file-picker'
import { registerAddOpenFilesCommand } from './add-open-files'
import { registerClearAllCommand } from './clear-all'
import { registerCopyAllCommand } from './copy-all'
import { registerCopyFileCommand } from './copy-file'
import { registerManageExcludesCommand } from './manage-excludes'
import { registerPreviewContextCommand } from './preview-context'
import { registerRemoveFileCommand } from './remove-file'
import { registerTogglePinCommand } from './toggle-pin'
import { registerTrackCommands } from './track-ops'

export interface CommandDependencies {
  context: vscode.ExtensionContext
  services: ServiceRegistry
  views: ViewManager
}

/**
 * Main entry point for command registration.
 * Delegates to specialized subgroups to keep the logic flat.
 */
export function registerAllCommands(deps: CommandDependencies) {
  registerStackModifications(deps)
  registerClipboardOperations(deps)
  registerTrackOperations(deps)
  registerViewOperations(deps)
}

function registerStackModifications(deps: CommandDependencies) {
  registerAddFileCommand(deps.context, deps.services.contextStackProvider)
  registerAddFileContextMenuCommand(
    deps.context,
    deps.services.contextStackProvider,
    deps.services.ignorePatternProvider,
  )
  registerAddFilePickerCommand(deps.context, deps.services.contextStackProvider, deps.services.ignorePatternProvider)
  registerAddOpenFilesCommand(deps.context, deps.services.contextStackProvider)
  registerRemoveFileCommand(deps.context, deps.services.contextStackProvider, deps.views.filesView)
  registerTogglePinCommand(deps.context, deps.services.contextTrackManager, deps.views.filesView)
  registerClearAllCommand(deps.context, deps.services.contextStackProvider)
}

function registerClipboardOperations(deps: CommandDependencies) {
  registerCopyAllCommand(deps.context, deps.services.contextStackProvider)
  registerCopyFileCommand(deps.context, deps.services.contextStackProvider, deps.views.filesView)
}

function registerTrackOperations(deps: CommandDependencies) {
  registerTrackCommands(deps.context, deps.services.contextTrackManager, deps.views.tracksView)
}

function registerViewOperations(deps: CommandDependencies) {
  registerPreviewContextCommand(deps.context, deps.services.contextStackProvider)
  registerManageExcludesCommand(deps.context)
}
