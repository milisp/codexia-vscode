# Codexia VSCode Extension

> **Important:** This plugin requires **Codex CLI** to be installed separately.  
> For more information, see [Codex CLI](https://github.com/openai/codex).

Codex CLI seamlessly integrates with popular IDEs (including VSCode) to enhance your coding workflow.  
This integration allows you to leverage Codex’s capabilities directly within your preferred development environment.

## Features
- **Auto-installation**: When you launch Codex CLI from within VSCode’s terminal, it automatically detects and installs the extension.
- **Selection context**: Selected text in the editor is automatically added to Codex’s context.
- **Diff viewing**: Code changes can be displayed directly in VSCode’s diff viewer instead of the terminal.
- **Keyboard shortcuts**: Support for shortcuts (e.g., `Alt+Cmd+K`) to push selected code into Codex’s prompt.
- **Tab awareness**: Codex can see which files you have open in the editor.
- **Configuration**: Set `diff tool = auto` in `/config` to enable IDE integration features.

## Requirements
- Visual Studio Code **1.98.0 or higher**
- Codex CLI installed separately

---

## Known Issues
- This is an early release and may contain bugs or incomplete features.