# Codex Diff Feature Description

When Codex modifies files, the VS Code extension automatically displays a diff view to show all changes.

## Features

### 1. Automatic Diff Detection
- When Codex finishes modifying files, the extension receives a `turn_diff` event
- Automatically parses the changes in unified diff format
- Supports detecting various file operations such as addition, modification, deletion, and renaming

### 2. Intelligent Notification System
When file changes are detected, a notification is displayed including:
- Summary of changes (e.g., "1 file added, 2 files modified")
- **Show Details** button: displays a detailed summary of changes
- **Open Changed Files** button: opens all changed files in the editor

### 3. Visual Diff View
- For modified and renamed files, automatically opens VS Code's built-in diff view
- Left side shows the original content, right side shows the modified content
- Highlights the specific changed lines

### 4. Detailed Change Summary
Clicking "Show Details" opens a Markdown document containing:
- Change type for each file (added/modified/deleted/renamed)
- Number of changed code blocks and line count statistics
- Clear icons indicating different types of changes

## Technical Implementation

### Core Components

1. **CodexService** (`src/codexService.ts`)
   - Listens to the `turn_diff` event from Codex CLI
   - Parses the `unified_diff` field in EventMsg

2. **DiffUtils** (`src/diffUtils.ts`)
   - Parses unified diff format
   - Extracts file paths, change types, and code block information
   - Generates change summaries

3. **DiffViewerManager** (`src/diffViewer.ts`)
   - Manages diff display logic
   - Reconstructs original file content for comparison
   - Integrates VS Code's diff viewer

4. **Extension** (`src/extension.ts`)
   - Handles diff events in the extension's main entry point
   - Avoids mixing view logic in ChatProvider

### Event Flow

```
Codex CLI modifies files
    ↓
Sends turn_diff event (WebSocket)
    ↓
CodexService receives and parses event
    ↓
Extension.ts handles turn-diff event
    ↓
DiffViewerManager displays diff
    ↓
User sees notification and diff view
```

## Usage

### Normal Usage
1. Request file modification in Codex chat
2. When Codex finishes modification, a notification automatically pops up
3. Click notification buttons to view details or open files
4. View the diff to understand specific changes

### Testing Feature
1. Press `Ctrl+Shift+P` to open the command palette
2. Type "Test Diff Viewer"
3. Execute the command to see a demo diff

## Supported File Operations

- ✅ **Add File**: shows the full content of the new file
- ✅ **Modify File**: shows line-level changes
- ✅ **Delete File**: shows the content of the deleted file  
- ✅ **Rename File**: shows a comparison before and after renaming
- ✅ **Binary Files**: shows "Binary files differ" message

## Configuration

No additional configuration is required; the feature triggers automatically under these conditions:
- After Codex executes the `apply_patch` tool
- When any file changes are detected

## Notes

1. **Permission Requirements**: requires permission to read workspace files
2. **File Existence**: cannot display diff for deleted files (because the file no longer exists)
3. **Large Files**: diff reconstruction may take some time for very large files
4. **Workspace**: feature requires usage within a VS Code workspace environment

## Troubleshooting

If the diff feature does not work:
1. Check logs in the VS Code developer console
2. Confirm Codex CLI is sending `turn_diff` events
3. Verify workspace path settings are correct
4. Try using the test command to verify functionality