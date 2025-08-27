import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ContextManager } from './contextManager';

// File explorer tree data provider
class FileExplorerProvider implements vscode.TreeDataProvider<FileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | null | void> = new vscode.EventEmitter<FileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string, private contextManager: ContextManager) {
        contextManager.onDidChangeContext(() => this._onDidChangeTreeData.fire());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FileItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileItem): Thenable<FileItem[]> {
        if (!this.workspaceRoot) {
            console.log('[FileExplorerProvider] workspaceRoot is not set');
            return Promise.resolve([]);
        }

        const dirPath = element ? element.resourceUri.fsPath : this.workspaceRoot;
        console.log('[FileExplorerProvider] getChildren dirPath:', dirPath);
        
        try {
            const files = fs.readdirSync(dirPath);
            console.log('[FileExplorerProvider] files in dirPath:', files);
            const items: FileItem[] = [];

            for (const file of files) {
                const filePath = path.join(dirPath, file);
                let stat;
                try {
                    stat = fs.statSync(filePath);
                } catch (statErr) {
                    console.error('[FileExplorerProvider] statSync error for', filePath, statErr);
                    continue;
                }
                
                if (stat.isDirectory()) {
                    items.push(new FileItem(
                        file,
                        vscode.Uri.file(filePath),
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'folder',
                        this.contextManager.isInContext(filePath)
                    ));
                } else {
                    items.push(new FileItem(
                        file,
                        vscode.Uri.file(filePath),
                        vscode.TreeItemCollapsibleState.None,
                        'file',
                        this.contextManager.isInContext(filePath)
                    ));
                }
            }

            // Update contextValue and icons for all items
            for (const item of items) {
                // Always show the default file/folder icons - the + and - buttons will be inline
                item.iconPath = item.itemType === 'file'
                    ? new vscode.ThemeIcon('file')
                    : new vscode.ThemeIcon('folder');

                console.log(`[FileExplorerProvider] Item: ${item.label}, contextValue: ${item.contextValue}`);
            }

            return Promise.resolve(items);
        } catch (error) {
            console.error('[FileExplorerProvider] getChildren error:', error);
            return Promise.resolve([]);
        }
    }
}

class FileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly resourceUri: vscode.Uri,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'file' | 'folder',
        public readonly inContext: boolean
    ) {
        super(label, collapsibleState);
        
        this.tooltip = this.resourceUri.fsPath;
        this.contextValue = inContext ? `${itemType}_in_context` : `${itemType}_not_in_context`;
        
        console.log(`[FileItem] Creating item: ${label}, inContext: ${inContext}, contextValue: ${this.contextValue}`);
        
        // Always show the default file/folder icons - the + and - buttons will be inline
        this.iconPath = itemType === 'file' ? 
            new vscode.ThemeIcon('file') : 
            new vscode.ThemeIcon('folder');

        // Add command to open file in editor when clicked
        if (itemType === 'file') {
            this.command = {
                command: 'extension.openFileInEditor',
                title: 'Open File',
                arguments: [this.resourceUri]
            };
        }
    }
}

export { FileExplorerProvider, FileItem }; 