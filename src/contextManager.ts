import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// Context manager for tracking added files
class ContextManager {
    private contextFiles: Set<string> = new Set();
    private _onDidChangeContext: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onDidChangeContext: vscode.Event<void> = this._onDidChangeContext.event;

    addFile(filePath: string): void {
        this.contextFiles.add(filePath);
        this._onDidChangeContext.fire();
        vscode.commands.executeCommand('context8.refresh');
    }

    removeFile(filePath: string): void {
        this.contextFiles.delete(filePath);
        this._onDidChangeContext.fire();
        vscode.commands.executeCommand('context8.refresh');
    }

    isInContext(filePath: string): boolean {
        return this.contextFiles.has(filePath);
    }

    getContextFiles(): string[] {
        return Array.from(this.contextFiles);
    }

    getContextContent(): string {
        let content = '';
        for (const filePath of this.contextFiles) {
            try {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                content += `\n--- ${path.basename(filePath)} ---\n${fileContent}\n`;
            } catch (error) {
                content += `\n--- ${path.basename(filePath)} (Error reading file) ---\n`;
            }
        }
        return content;
    }
}

export { ContextManager }; 