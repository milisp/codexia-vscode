import * as vscode from "vscode";
import { ChatProvider } from "./chatProvider";
import { CodexService } from "./codexService";
import { ConfigManager } from "./config";
import { DiffViewerManager } from "./diffViewer";
import { registerDevCommands } from "./devCommands";
import { ContextManager } from "./contextManager";
import { FileExplorerProvider } from "./fileExplorerProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log("Codexia extension is now active!");

  // Initialize services
  const configManager = new ConfigManager(context);
  const codexService = new CodexService(configManager);
  const contextManager = new ContextManager();
  const chatProvider = new ChatProvider(context, codexService, configManager, contextManager);
  const diffViewer = DiffViewerManager.getInstance();

  // Initialize file explorer
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  let fileExplorerProvider: FileExplorerProvider | undefined;
  if (workspaceRoot) {
    fileExplorerProvider = new FileExplorerProvider(workspaceRoot, contextManager);
    vscode.window.createTreeView('codexia.fileExplorer', {
      treeDataProvider: fileExplorerProvider
    });
  }

  // Set up global diff event handling
  codexService.on("turn-diff", (unifiedDiff: string) => {
    console.log("Extension: Received turn-diff event, showing diff");
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    diffViewer.showDiff(unifiedDiff, workspaceRoot);
  });

  // Register webview providers
  const chatViewProvider = vscode.window.registerWebviewViewProvider(
    "codexia.chatView",
    chatProvider,
    { webviewOptions: { retainContextWhenHidden: true } },
  );

  // Register commands
  const newTaskCommand = vscode.commands.registerCommand(
    "codexia.newTask",
    () => {
      chatProvider.newTask();
    },
  );

  const settingsCommand = vscode.commands.registerCommand(
    "codexia.openSettings",
    () => {
      chatProvider.showSettings();
    },
  );

  const configChangedCommand = vscode.commands.registerCommand(
    "codexia.configChanged",
    () => {
      // Notify chat provider that config changed
      chatProvider.onConfigChanged();
    },
  );

  const clearHistoryCommand = vscode.commands.registerCommand(
    "codexia.clearHistory",
    () => {
      chatProvider.clearHistory();
    },
  );

  const addToContextCommand = vscode.commands.registerCommand(
    "codexia.addToContext",
    (item: any) => {
      console.log("[Extension] addToContext command called with:", item);
      if (item && item.resourceUri) {
        console.log("[Extension] Adding file to context:", item.resourceUri.fsPath);
        contextManager.addFile(item.resourceUri.fsPath);
      } else {
        console.log("[Extension] addToContext called without valid item");
      }
    },
  );

  const removeFromContextCommand = vscode.commands.registerCommand(
    "codexia.removeFromContext",
    (item: any) => {
      console.log("[Extension] removeFromContext command called with:", item);
      if (item && item.resourceUri) {
        console.log("[Extension] Removing file from context:", item.resourceUri.fsPath);
        contextManager.removeFile(item.resourceUri.fsPath);
      } else {
        console.log("[Extension] removeFromContext called without valid item");
      }
    },
  );

  const refreshCommand = vscode.commands.registerCommand(
    "codexia.refresh",
    () => {
      console.log("[Extension] refresh command called");
      // The file explorer will auto-refresh due to context changes
      if (fileExplorerProvider) {
        console.log("[Extension] Refreshing file explorer");
        fileExplorerProvider.refresh();
      } else {
        console.log("[Extension] No file explorer provider to refresh");
      }
    },
  );

  context.subscriptions.push(
    chatViewProvider,
    newTaskCommand,
    settingsCommand,
    configChangedCommand,
    clearHistoryCommand,
    addToContextCommand,
    removeFromContextCommand,
    refreshCommand,
  );

  registerDevCommands(context);
}

export function deactivate() {}
