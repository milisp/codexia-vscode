import * as vscode from "vscode";
import { ChatProvider } from "./chatProvider";
import { CodexService } from "./codexService";
import { ConfigManager } from "./config";
import { DiffViewerManager } from "./diffViewer";
import { registerDevCommands } from "./devCommands";

export function activate(context: vscode.ExtensionContext) {
  console.log("Codexia extension is now active!");

  // Initialize services
  const configManager = new ConfigManager(context);
  const codexService = new CodexService(configManager);
  const chatProvider = new ChatProvider(context, codexService, configManager);
  const diffViewer = DiffViewerManager.getInstance();

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

  context.subscriptions.push(
    chatViewProvider,
    newTaskCommand,
    settingsCommand,
    configChangedCommand,
    clearHistoryCommand,
  );

  registerDevCommands(context);
}

export function deactivate() {}
