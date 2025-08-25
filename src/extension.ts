import * as vscode from "vscode";
import { ChatProvider } from "./chatProvider";
import { CodexService } from "./codexService";
import { SettingsProvider } from "./settingsProvider";
import { ConfigManager } from "./config";

export function activate(context: vscode.ExtensionContext) {
  console.log("Codexia extension is now active!");

  // Initialize services
  const configManager = new ConfigManager(context);
  const codexService = new CodexService(configManager);
  const chatProvider = new ChatProvider(context, codexService);
  const settingsProvider = new SettingsProvider(context, configManager);

  // Register webview providers
  const chatViewProvider = vscode.window.registerWebviewViewProvider(
    "codexia.chatView",
    chatProvider,
    { webviewOptions: { retainContextWhenHidden: true } },
  );

  const settingsViewProvider = vscode.window.registerWebviewViewProvider(
    "codexia.settingsView",
    settingsProvider,
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
      settingsProvider.show();
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
    settingsViewProvider,
    newTaskCommand,
    settingsCommand,
    configChangedCommand,
    clearHistoryCommand,
  );
}

export function deactivate() {}
