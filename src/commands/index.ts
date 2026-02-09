import * as vscode from 'vscode'

import { getAddCurrentFileCommands } from './add-current-file'
import { getAddFileContextMenuCommands } from './add-file-context-menu'
import { getAddFilePickerCommands } from './add-file-picker'
import { getAddFolderPickerCommands } from './add-folder-picker'
import { getAddOpenFilesCommands } from './add-open-files'
import { getClearAllCommands } from './clear-all'
import { getCopyAllCommands } from './copy-all'
import { getCopyAndClearCommands } from './copy-and-clear'
import { getCopyFileCommands } from './copy-file'
import { getFilterCommands } from './filter-commands'
import { getPreviewContextCommands } from './preview-context'
import { getRefreshFolderCommand, getRefreshStackCommands } from './refresh-stack'
import { getRemoveFileCommands } from './remove-file'
import { getRemoveFilePickerCommands } from './remove-file-picker'
import { getRemoveFolderPickerCommands } from './remove-folder-picker'
import { getRevealInExplorerCommands } from './reveal-in-explorer'
import { getRevealInViewCommands } from './reveal-in-view'
import { getSelectAllCommands } from './select-all'
import { getOpenSettingsCommands } from './settings'
import { getTogglePinCommands } from './toggle-pin'
import { getTrackCommands } from './track-ops'
import { Command, CommandDependencies } from './types'
import { getUnpinAllCommands } from './unpin-all'

export { CommandDependencies } from './types'

export function registerAllCommands(deps: CommandDependencies): void {
  const factories = [
    getAddCurrentFileCommands,
    getAddFileContextMenuCommands,
    getAddFilePickerCommands,
    getAddFolderPickerCommands,
    getAddOpenFilesCommands,
    getRemoveFileCommands,
    getRemoveFilePickerCommands,
    getRemoveFolderPickerCommands,
    getTogglePinCommands,
    getUnpinAllCommands,
    getClearAllCommands,
    getSelectAllCommands,
    getRefreshStackCommands,
    getRefreshFolderCommand,

    getCopyAllCommands,
    getCopyAndClearCommands,
    getCopyFileCommands,

    getTrackCommands,

    getPreviewContextCommands,
    getOpenSettingsCommands,
    getFilterCommands,
    getRevealInViewCommands,
    getRevealInExplorerCommands,
  ]

  const allCommands = factories.flatMap((factory) => factory(deps))

  allCommands.forEach((cmd) => {
    register(deps.context, cmd)
  })
}

function register(context: vscode.ExtensionContext, cmd: Command): void {
  context.subscriptions.push(vscode.commands.registerCommand(cmd.id, cmd.execute))
}
