import * as vscode from 'vscode'

/**
 * Registers the command to manage exclusion patterns via a Checkbox Library.
 * @param context - Required for accessing globalState history.
 */
export function registerManageExcludesCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.manageExcludes', () => {
      new ExclusionManager(context).show()
    }),
  )
}

/**
 * Manages the UI and State for the Exclusion Library.
 */
class ExclusionManager {
  private picker: vscode.QuickPick<vscode.QuickPickItem>
  private state: StateManager
  private isSwitchingInput = false

  constructor(context: vscode.ExtensionContext) {
    this.state = new StateManager(context)
    this.picker = vscode.window.createQuickPick()
    this.configurePicker()
  }

  public show() {
    this.refreshItems()
    this.picker.show()
  }

  private configurePicker() {
    this.picker.title = 'Exclude Manager (Library)'
    this.picker.placeholder = 'Check items to ACTIVATE. Unchecked items remain in your library.'
    this.picker.canSelectMany = true

    this.picker.buttons = [
      {
        iconPath: new vscode.ThemeIcon('add'),
        tooltip: 'Add new pattern to library',
      },
    ]

    this.picker.onDidAccept(() => this.handleAccept())

    this.picker.onDidTriggerButton((btn) => this.handleAddButton(btn))

    this.picker.onDidHide(() => {
      if (!this.isSwitchingInput) {
        this.picker.dispose()
      }
    })
  }

  private refreshItems() {
    const { history, active } = this.state.getData()

    // Combine history and active, unique them, and sort alphabetically
    const allPatterns = Array.from(new Set([...history, ...active])).sort()

    // Map to QuickPickItems
    this.picker.items = allPatterns.map((label) => ({
      label,
      buttons: [{ iconPath: new vscode.ThemeIcon('trash'), tooltip: 'Delete permanently' }],
    }))

    this.picker.selectedItems = this.picker.items.filter((item) => active.includes(item.label))
  }

  private async handleAccept() {
    // User clicked "OK" (Enter). Save the current checkboxes.
    const active = this.picker.selectedItems.map((i) => i.label)
    const allKnown = this.picker.items.map((i) => i.label)

    await this.state.save(active, allKnown)

    this.picker.dispose()
  }

  private async handleAddButton(btn: vscode.QuickInputButton) {
    if (btn.tooltip?.includes('Add')) {
      await this.promptForNewPattern()
    }
  }

  /**
   * The "Add" workflow that keeps the parent menu alive.
   */
  private async promptForNewPattern() {
    this.isSwitchingInput = true
    this.picker.hide()

    try {
      const input = await vscode.window.showInputBox({
        title: 'Add New Pattern',
        prompt: "Enter folder name (e.g. 'tests') or glob (e.g. '*.log')",
        placeHolder: 'tests',
        ignoreFocusOut: true,
      })

      if (input?.trim()) {
        const pattern = SmartPattern.generate(input.trim())
        await this.state.addToHistory(pattern)

        this.refreshItems()
      }
    } finally {
      this.isSwitchingInput = false
      this.picker.show()
    }
  }
}

/**
 * Handles persistence: Active (Settings) vs. History (GlobalState).
 */
class StateManager {
  private static readonly CONFIG_KEY = 'aiContextStacker'
  private static readonly SETTING = 'excludes'
  private static readonly STATE_KEY = 'excludesHistory'

  constructor(private context: vscode.ExtensionContext) {}

  public getData() {
    const config = vscode.workspace.getConfiguration(StateManager.CONFIG_KEY)
    const active = config.get<string[]>(StateManager.SETTING, [])
    const history = this.context.globalState.get<string[]>(StateManager.STATE_KEY, [])
    return { active, history }
  }

  public async save(active: string[], allKnown: string[]) {
    await vscode.workspace
      .getConfiguration(StateManager.CONFIG_KEY)
      .update(StateManager.SETTING, active, vscode.ConfigurationTarget.Global)

    await this.context.globalState.update(StateManager.STATE_KEY, allKnown)
  }

  public async addToHistory(pattern: string) {
    const { history } = this.getData()
    if (!history.includes(pattern)) {
      await this.context.globalState.update(StateManager.STATE_KEY, [...history, pattern])
    }
  }
}

/**
 * Helper to normalize inputs.
 */
class SmartPattern {
  static generate(input: string): string {
    const isSimpleWord = /^[a-zA-Z0-9_-]+$/.test(input)
    return isSimpleWord ? `**/${input}/**` : input
  }
}
