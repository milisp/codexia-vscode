import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileChange, parseUnifiedDiff, createChangeSummary } from './diffUtils';

export class DiffViewerManager {
  private static instance: DiffViewerManager | null = null;
  private diffProvider: DiffDocumentProvider;

  private constructor() {
    this.diffProvider = new DiffDocumentProvider();
    vscode.workspace.registerTextDocumentContentProvider('codex-diff', this.diffProvider);
  }

  public static getInstance(): DiffViewerManager {
    if (!this.instance) {
      this.instance = new DiffViewerManager();
    }
    return this.instance;
  }

  /**
   * Process and display diff from Codex
   */
  public async showDiff(unifiedDiff: string, workspaceRoot?: string): Promise<void> {
    if (!unifiedDiff.trim()) {
      vscode.window.showInformationMessage('No changes detected');
      return;
    }

    const fileChanges = parseUnifiedDiff(unifiedDiff);
    
    if (fileChanges.length === 0) {
      vscode.window.showInformationMessage('No file changes detected');
      return;
    }

    const summary = createChangeSummary(fileChanges);
    console.log(`Codex changes: ${summary}`);

    // Show summary notification
    const showDetails = 'Show Details';
    const openFiles = 'Open Changed Files';
    const action = await vscode.window.showInformationMessage(
      `Codex made changes: ${summary}`,
      showDetails,
      openFiles
    );

    if (action === showDetails) {
      await this.showDiffSummary(fileChanges);
    } else if (action === openFiles) {
      await this.openChangedFiles(fileChanges, workspaceRoot);
    }

    // Always show diffs for modified files
    await this.showFileDiffs(fileChanges, workspaceRoot);
  }

  /**
   * Show diff summary in a new document
   */
  private async showDiffSummary(fileChanges: FileChange[]): Promise<void> {
    let content = '# Codex Changes Summary\n\n';
    
    for (const change of fileChanges) {
      content += `## ${this.getChangeIcon(change.changeType)} ${change.filePath}\n`;
      
      if (change.changeType === 'rename' && change.oldPath) {
        content += `*Renamed from: ${change.oldPath}*\n`;
      }
      
      content += `**Type:** ${change.changeType}\n`;
      
      if (change.hunks.length > 0) {
        content += `**Changes:** ${change.hunks.length} hunk(s)\n`;
        
        for (const hunk of change.hunks) {
          const addedLines = hunk.lines.filter(l => l.type === 'add').length;
          const deletedLines = hunk.lines.filter(l => l.type === 'delete').length;
          content += `- Lines ${hunk.newStart}-${hunk.newStart + hunk.newLines - 1}: +${addedLines} -${deletedLines}\n`;
        }
      }
      
      content += '\n';
    }

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });
    
    await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: vscode.ViewColumn.Beside
    });
  }

  /**
   * Open all changed files in the editor
   */
  private async openChangedFiles(fileChanges: FileChange[], workspaceRoot?: string): Promise<void> {
    const root = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    
    for (const change of fileChanges) {
      if (change.changeType === 'delete') {
        continue; // Can't open deleted files
      }
      
      const fullPath = path.isAbsolute(change.filePath) 
        ? change.filePath 
        : path.join(root, change.filePath);
        
      try {
        const uri = vscode.Uri.file(fullPath);
        
        // Check if file exists
        if (fs.existsSync(fullPath)) {
          await vscode.window.showTextDocument(uri, {
            preview: false,
            viewColumn: vscode.ViewColumn.Active
          });
        }
      } catch (error) {
        console.error(`Failed to open file ${fullPath}:`, error);
      }
    }
  }

  /**
   * Show diff views for modified files
   */
  private async showFileDiffs(fileChanges: FileChange[], workspaceRoot?: string): Promise<void> {
    const root = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    
    for (const change of fileChanges) {
      if (change.changeType === 'modify' || change.changeType === 'rename') {
        await this.showSingleFileDiff(change, root);
      }
    }
  }

  /**
   * Show diff for a single file using VS Code's built-in diff viewer
   */
  private async showSingleFileDiff(change: FileChange, workspaceRoot: string): Promise<void> {
    try {
      const currentPath = path.isAbsolute(change.filePath)
        ? change.filePath
        : path.join(workspaceRoot, change.filePath);

      if (!fs.existsSync(currentPath)) {
        console.warn(`File does not exist: ${currentPath}`);
        return;
      }

      // Create original content from diff
      const originalContent = await this.reconstructOriginalContent(change, currentPath);
      
      // Store original content in diff provider
      const originalUri = vscode.Uri.parse(`codex-diff:${change.filePath}.original`);
      this.diffProvider.setContent(originalUri.toString(), originalContent);

      const currentUri = vscode.Uri.file(currentPath);
      
      // Open diff view
      await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        currentUri,
        `${change.filePath} (Codex Changes)`,
        {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside
        }
      );
    } catch (error) {
      console.error(`Failed to show diff for ${change.filePath}:`, error);
    }
  }

  /**
   * Reconstruct original file content from diff hunks
   */
  private async reconstructOriginalContent(change: FileChange, currentPath: string): Promise<string> {
    try {
      const currentContent = fs.readFileSync(currentPath, 'utf8');
      const currentLines = currentContent.split('\n');
      
      // Start with current content and reverse the changes
      const originalLines: string[] = [];
      let currentIndex = 0;
      
      // If no hunks, return current content (shouldn't happen for modify)
      if (change.hunks.length === 0) {
        return currentContent;
      }

      for (const hunk of change.hunks) {
        // Add lines before this hunk
        while (currentIndex < hunk.newStart - 1 && currentIndex < currentLines.length) {
          originalLines.push(currentLines[currentIndex]);
          currentIndex++;
        }

        // Process hunk lines
        for (const line of hunk.lines) {
          if (line.type === 'context' || line.type === 'delete') {
            // Context and deleted lines were in the original
            originalLines.push(line.content);
          }
          // Skip added lines - they weren't in the original
          
          if (line.type === 'context' || line.type === 'add') {
            // Move past this line in current content
            currentIndex++;
          }
        }
      }

      // Add remaining lines after all hunks
      while (currentIndex < currentLines.length) {
        originalLines.push(currentLines[currentIndex]);
        currentIndex++;
      }

      return originalLines.join('\n');
    } catch (error) {
      console.error('Failed to reconstruct original content:', error);
      // Fallback: return current content
      return fs.readFileSync(currentPath, 'utf8');
    }
  }

  private getChangeIcon(changeType: string): string {
    switch (changeType) {
      case 'add': return '➕';
      case 'delete': return '❌';
      case 'modify': return '📝';
      case 'rename': return '📋';
      default: return '📄';
    }
  }
}

/**
 * Document provider for diff content
 */
class DiffDocumentProvider implements vscode.TextDocumentContentProvider {
  private content = new Map<string, string>();

  setContent(uri: string, content: string): void {
    this.content.set(uri, content);
  }

  provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
    const content = this.content.get(uri.toString());
    return content || '';
  }
}