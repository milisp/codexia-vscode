import * as vscode from "vscode";
import { ConfigManager, CodexConfig } from "./config";

export class SettingsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codexia.settingsView";

  private _view?: vscode.WebviewView;
  private _configManager: ConfigManager;

  constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    configManager: ConfigManager,
  ) {
    this._configManager = configManager;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionContext.extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "updateConfig":
            this._handleConfigUpdate(message.config);
            break;
          case "getConfig":
            this._sendCurrentConfig();
            break;
          case "resetConfig":
            this._resetConfig();
            break;
        }
      },
      undefined,
      this._extensionContext.subscriptions,
    );

    // Send initial config
    setTimeout(() => this._sendCurrentConfig(), 100);
  }

  private async _handleConfigUpdate(config: Partial<CodexConfig>) {
    try {
      await this._configManager.saveConfig(config);
      vscode.window.showInformationMessage(
        "Codexia configuration updated successfully!",
      );

      // Notify chat provider about config change
      vscode.commands.executeCommand("codexia.configChanged");
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private _sendCurrentConfig() {
    const config = this._configManager.getConfig();
    const modelOptions = ConfigManager.getModelOptions();
    const providers = ConfigManager.getProviderOptions();
    const approvalPolicies = ConfigManager.getApprovalPolicyOptions();
    const sandboxModes = ConfigManager.getSandboxModeOptions();
    const providerEnvVars = ConfigManager.getProviderEnvVars();

    this._view?.webview.postMessage({
      type: "configData",
      config,
      modelOptions,
      providers,
      approvalPolicies,
      sandboxModes,
      providerEnvVars,
    });
  }

  private async _resetConfig() {
    try {
      await this._configManager.saveConfig({});
      this._sendCurrentConfig();
      vscode.window.showInformationMessage("Configuration reset to defaults!");
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to reset configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get URIs for the webview build
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionContext.extensionUri,
        "out",
        "webview-ui",
        "assets",
        "settings.js",
      ),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionContext.extensionUri,
        "out",
        "webview-ui",
        "assets",
        "settings.css",
      ),
    );

    const nonce = this._getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet">
				<title>Codexia Settings</title>
			</head>
			<body>
				<div id="settings-root"></div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }

  private _getNonce() {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public show() {
    if (this._view) {
      this._view.show(true);
    }
  }
}