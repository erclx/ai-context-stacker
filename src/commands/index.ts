import * as vscode from 'vscode'

import { ServiceRegistry } from '../services'
import { ViewManager } from '../ui'
import { registerAddFileCommand } from './add-file'
import { registerAddFileContextMenuCommand } from './add-file-context-menu'
import { registerAddFilePickerCommand } from './add-file-picker'
import { registerAddFolderPickerCommand } from './add-folder-picker'
import { registerAddOpenFilesCommand } from './add-open-files'
import { registerClearAllCommand } from './clear-all'
import { registerConfigureOutputCommand } from './configure-output'
import { registerCopyAllCommand } from './copy-all'
import { registerCopyContentCommand } from './copy-content'
import { registerCopyFileCommand } from './copy-file'
import { registerCopyTreeCommand } from './copy-tree'
import { registerFilterCommands } from './filter-commands'
import { registerManageExcludesCommand } from './manage-excludes'
import { registerPreviewContextCommand } from './preview-context'
import { registerRemoveFileCommand } from './remove-file'
import { registerRemoveFilePickerCommand } from './remove-file-picker'
import { registerRevealInExplorerCommand } from './reveal-in-explorer'
import { registerRevealInViewCommand } from './reveal-in-view'
import { registerSelectAllCommand } from './select-all'
import { registerSetThresholdCommand } from './set-threshold'
import { registerTogglePinCommand } from './toggle-pin'
import { registerTrackCommands } from './track-ops'

export interface CommandDependencies {
  context: vscode.ExtensionContext
  services: ServiceRegistry
  views: ViewManager
}

/**
 * Main entry point for command registration.
 */
export function registerAllCommands(deps: CommandDependencies) {
  registerStackModifications(deps)
  registerClipboardOperations(deps)
  registerTrackOperations(deps)
  registerViewOperations(deps)
}

function registerStackModifications(deps: CommandDependencies) {
  registerAddFileCommand(deps.context, deps.services.stackProvider)
  registerAddFileContextMenuCommand(deps.context, deps.services.stackProvider, deps.services.ignoreManager)
  registerAddFilePickerCommand(deps.context, deps.services.stackProvider, deps.services.ignoreManager)
  registerAddFolderPickerCommand(deps.context, deps.services.stackProvider, deps.services.ignoreManager)
  registerAddOpenFilesCommand(deps.context, deps.services.stackProvider)
  registerRemoveFileCommand(deps.context, deps.services.stackProvider, deps.views.filesView)
  registerRemoveFilePickerCommand(deps.context, deps.services.stackProvider)
  registerTogglePinCommand(deps.context, deps.services.trackManager, deps.views.filesView)
  registerClearAllCommand(deps.context, deps.services.stackProvider)
  registerSelectAllCommand(deps.context)
}

function registerClipboardOperations(deps: CommandDependencies) {
  registerCopyAllCommand(deps.context, deps.services.stackProvider)
  registerCopyFileCommand(deps.context, deps.services.stackProvider, deps.views.filesView)
  registerCopyTreeCommand(deps.context, deps.services.stackProvider)
  registerCopyContentCommand(deps.context, deps.services.stackProvider)
}

function registerTrackOperations(deps: CommandDependencies) {
  registerTrackCommands(deps.context, deps.services.trackManager, deps.views.tracksView)
}

function registerViewOperations(deps: CommandDependencies) {
  registerPreviewContextCommand(deps.context, deps.services.stackProvider)
  registerManageExcludesCommand(deps.context)
  registerConfigureOutputCommand(deps.context)
  registerSetThresholdCommand(deps.context)
  registerFilterCommands(deps.context, deps.services.stackProvider)
  registerRevealInViewCommand(deps.context, deps.services.stackProvider, deps.views.filesView)
  registerRevealInExplorerCommand(deps.context)
}
