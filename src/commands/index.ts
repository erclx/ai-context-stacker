import * as vscode from 'vscode'

import { ContextStackProvider, IgnorePatternProvider } from '@/providers'

import { registerAddFileCommand } from './add-file'
import { registerAddFilePickerCommand } from './add-file-picker'
import { registerClearAllCommand } from './clear-all'
import { registerCopyAllCommand } from './copy-all'
import { registerCopyFileCommand } from './copy-file'
import { registerRemoveFileCommand } from './remove-file'

interface Providers {
  context: vscode.ExtensionContext
  contextStackProvider: ContextStackProvider
  ignorePatternProvider: IgnorePatternProvider
}

export function registerAllCommands({ context, contextStackProvider, ignorePatternProvider }: Providers) {
  registerAddFileCommand(context, contextStackProvider)
  registerAddFilePickerCommand(context, contextStackProvider, ignorePatternProvider)
  registerRemoveFileCommand(context, contextStackProvider)
  registerCopyAllCommand(context, contextStackProvider)
  registerCopyFileCommand(context)
  registerClearAllCommand(context, contextStackProvider)
}
