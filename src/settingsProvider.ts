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

    this._view?.webview.postMessage({
      type: "configData",
      config,
      modelOptions,
      providers,
      approvalPolicies,
      sandboxModes,
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
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionContext.extensionUri,
        "media",
        "reset.css",
      ),
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionContext.extensionUri,
        "media",
        "vscode.css",
      ),
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionContext.extensionUri,
        "media",
        "settings.css",
      ),
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionContext.extensionUri,
        "media",
        "settings.js",
      ),
    );

    const nonce = this._getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				<title>Codexia Settings</title>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h2>⚙️ Codexia Settings</h2>
						<button id="resetButton" class="secondary-button">Reset to Defaults</button>
					</div>

					<div class="settings-form">
						<!-- OSS Mode -->
						<div class="form-group">
							<label class="form-label">
								<input type="checkbox" id="useOss"> Use OSS Mode (--oss)
							</label>
							<p class="form-help">Enable to use local open source models via Ollama</p>
						</div>

						<!-- Provider Selection -->
						<div class="form-group" id="providerGroup">
							<label class="form-label" for="providerSelect">Provider</label>
							<select id="providerSelect" class="form-select">
								<option value="">Select a provider...</option>
							</select>
						</div>

						<!-- Model Selection -->
						<div class="form-group">
							<label class="form-label" for="modelSelect">Model (-m)</label>
							<select id="modelSelect" class="form-select">
								<option value="">Select a model...</option>
							</select>
							<input type="text" id="customModel" class="form-input" placeholder="Or enter custom model name" style="display: none;">
						</div>

						<!-- Approval Policy -->
						<div class="form-group">
							<label class="form-label" for="approvalSelect">Approval Policy</label>
							<select id="approvalSelect" class="form-select">
								<option value="">Select approval policy...</option>
							</select>
							<p class="form-help">Controls when you need to approve AI actions</p>
						</div>

						<!-- Sandbox Mode -->
						<div class="form-group">
							<label class="form-label" for="sandboxSelect">Sandbox Mode</label>
							<select id="sandboxSelect" class="form-select">
								<option value="">Select sandbox mode...</option>
							</select>
							<p class="form-help">Controls what files AI can access and modify</p>
						</div>

						<!-- Custom Arguments -->
						<div class="form-group">
							<label class="form-label" for="customArgs">Custom Arguments</label>
							<textarea id="customArgs" class="form-textarea" placeholder="Additional codex arguments (one per line)"></textarea>
							<p class="form-help">Additional command line arguments for codex (advanced)</p>
						</div>

						<!-- Command Preview -->
						<div class="form-group">
							<label class="form-label">Command Preview</label>
							<div id="commandPreview" class="command-preview">codex proto</div>
						</div>

						<!-- Actions -->
						<div class="form-actions">
							<button id="saveButton" class="primary-button">Save Configuration</button>
						</div>
					</div>
				</div>

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
