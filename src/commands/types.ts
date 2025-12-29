import * as vscode from 'vscode'

import { ServiceRegistry } from '../services'
import { ViewManager } from '../ui'

export interface CommandDependencies {
  context: vscode.ExtensionContext
  services: ServiceRegistry
  views: ViewManager
}

export interface Command {
  readonly id: string
  execute(...args: any[]): Promise<void> | void
}
