import * as vscode from "vscode";
import { CodexService } from "./codexService";
import { ConfigManager } from "./config";

interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "system" | "exec-request";
  content: string;
  timestamp: Date;
  execRequestId?: string;
}

export class ChatProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codexia.chatView";

  private _view?: vscode.WebviewView;
  private _messages: ChatMessage[] = [];
  private _isProcessing = false;
  private _currentStreamingMessage?: ChatMessage;

  // State management (following Rust implementation)
  private _activeExecCell?: { id: string; commands: string[] };
  private _runningCommands: Map<string, { id: string; command: string }> =
    new Map();
  

  constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _codexService: CodexService,
    private readonly _configManager: ConfigManager,
  ) {}

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
          case "sendMessage":
            this._handleUserMessage(message.text);
            break;
          case "clearChat":
            this._clearMessages();
            break;
          case "approveExecution":
            this._handleExecutionApproval(message.execRequestId, message.approved);
            break;
          case "getChatHistory":
            this._handleGetChatHistory();
            break;
          case "loadChatSession":
            this._handleLoadChatSession(message.sessionId);
            break;
          case "deleteChatSession":
            this._handleDeleteChatSession(message.sessionId);
            break;
          case "getSettings":
            this._handleGetSettings();
            break;
          case "saveSettings":
            this._handleSaveSettings(message.settings);
            break;
          case "resetSettings":
            this._handleResetSettings();
            break;
          case "getConfig":
            this._handleGetConfig();
            break;
          case "updateConfig":
            this._handleUpdateConfig(message.config);
            break;
          case "resetConfig":
            this._handleResetConfig();
            break;
        }
      },
      undefined,
      this._extensionContext.subscriptions,
    );

    // Set up CodexService event listeners
    this._setupCodexEventListeners();
  }

  public newTask() {
    if (this._view) {
      this._view.show?.(true);
      this._clearMessages();
      this._view.webview.postMessage({
        type: "hideSettings",
      });
      this._view.webview.postMessage({
        type: "focusInput",
      });
    }
  }

  public showSettings() {
    if (this._view) {
      this._view.show?.(true);
      this._view.webview.postMessage({
        type: "showSettings",
      });
    }
  }

  public onConfigChanged() {
    // Restart codex session with new configuration
    this._codexService.stopSession();

    const systemMessage: ChatMessage = {
      id: this._generateId(),
      type: "system",
      content: "Configuration updated. Session will restart with new settings.",
      timestamp: new Date(),
    };

    this._messages.push(systemMessage);
  }

  public clearHistory() {
    this._clearMessages();
    this._codexService.stopSession();
  }

  private _setupCodexEventListeners(): void {
    // Use only agent-message-delta for streaming
    this._codexService.on("agent-message-delta", (delta: string) => {
      this._onAgentMessageDelta(delta);
    });

    // Only use complete messages as fallback
    this._codexService.on("agent-message", (message: string) => {
      // console.log("ChatProvider: agent-message received (fallback):", message);
      // Only use if no streaming message is active
      if (!this._currentStreamingMessage) {
        this._onAgentMessage(message);
      }
    });

    this._codexService.on(
      "exec-request",
      (request: { id: string; command: string }) => {
        console.log("ChatProvider: exec-request received:", request);
        this._onExecRequest(request);
      },
    );

    this._codexService.on(
      "exec-output",
      (output: { call_id: string; stream: string; chunk: string }) => {
        console.log("ChatProvider: exec-output received:", output);
        this._onExecOutput(output);
      },
    );

    this._codexService.on(
      "exec-complete",
      (result: {
        call_id: string;
        stdout: string;
        stderr: string;
        exit_code: number;
      }) => {
        console.log("ChatProvider: exec-complete received:", result);
        this._onExecComplete(result);
      },
    );

    this._codexService.on(
      "task-complete",
      (completion: { last_message: string }) => {
        console.log("ChatProvider: task-complete received:", completion);
        this._onTaskComplete(completion);
      },
    );

    this._codexService.on("session-closed", () => {
      console.log("ChatProvider: session-closed received");
      this._onSessionClosed();
    });
  }


  // Individual event handlers
  private _onAgentMessage(message: string): void {
    console.log("ChatProvider: _onAgentMessage called with:", message);
    if (this._currentStreamingMessage) {
      this._currentStreamingMessage.content = message;
    } else {
      this._addMessage("assistant", message);
    }
    // Immediately update UI
    this._updateWebview();
  }

  private _onAgentMessageDelta(delta: string): void {
    if (!this._currentStreamingMessage) {
      // Start new streaming message
      this._currentStreamingMessage = {
        id: this._generateId(),
        type: "assistant",
        content: delta,
        timestamp: new Date(),
      };
      this._messages.push(this._currentStreamingMessage);
    } else {
      // Update existing streaming message
      this._currentStreamingMessage.content += delta;
    }
    // Update UI
    this._updateWebview();
  }

  private _onExecRequest(request: { id: string; command: string }): void {
    const execMessage: ChatMessage = {
      id: this._generateId(),
      type: "exec-request",
      content: `Execute command: ${request.command}`,
      timestamp: new Date(),
      execRequestId: request.id,
    };
    this._messages.push(execMessage);
    // Update UI
    this._updateWebview();
  }

  private _onExecCommandBegin(event: any): void {
    // Track running command
    this._runningCommands.set(event.call_id, {
      id: event.call_id,
      command: event.command?.join(" ") || "Unknown command",
    });

    // Update or create active exec cell
    if (!this._activeExecCell) {
      this._activeExecCell = {
        id: event.call_id,
        commands: [event.command?.join(" ") || "Unknown command"],
      };
    } else {
      this._activeExecCell.commands.push(
        event.command?.join(" ") || "Unknown command",
      );
    }

    // Immediately update UI
    this._updateWebview();
  }

  private _onExecOutput(output: {
    call_id: string;
    stream: string;
    chunk: string;
  }): void {
    const outputMessage: ChatMessage = {
      id: this._generateId(),
      type: "system",
      content: `${output.stream}: ${output.chunk}`,
      timestamp: new Date(),
    };
    this._messages.push(outputMessage);
    // Immediately update UI
    this._updateWebview();
  }

  private _onExecComplete(result: {
    call_id: string;
    stdout: string;
    stderr: string;
    exit_code: number;
  }): void {
    // Remove from running commands
    this._runningCommands.delete(result.call_id);

    // Clear active exec cell if no more running commands
    if (this._runningCommands.size === 0) {
      this._activeExecCell = undefined;
    }

    const resultMessage: ChatMessage = {
      id: this._generateId(),
      type: "system",
      content: `Command completed with exit code ${result.exit_code}${result.stdout ? "\nOutput: " + result.stdout : ""}${result.stderr ? "\nError: " + result.stderr : ""}`,
      timestamp: new Date(),
    };
    // this._messages.push(resultMessage);
    // Immediately update UI
    this._updateWebview();
  }

  private _onTaskComplete(completion: { last_message: string }): void {
    // console.log("ChatProvider: _onTaskComplete called with:", completion);
    this._isProcessing = false;
    this._currentStreamingMessage = undefined;
    this._runningCommands.clear();
    this._activeExecCell = undefined;

    // Don't add a separate completion message if we already have the response
    if (!completion.last_message || !this._currentStreamingMessage) {}

    // Update UI
    this._updateWebview();

    this._view?.webview.postMessage({
      type: "setTyping",
      isTyping: false,
    });
  }

  private _onSessionClosed(): void {
    this._isProcessing = false;
    this._currentStreamingMessage = undefined;
    this._runningCommands.clear();
    this._activeExecCell = undefined;
    this._view?.webview.postMessage({
      type: "setTyping",
      isTyping: false,
    });
  }

  private async _handleUserMessage(text: string) {
    if (this._isProcessing) {
      return;
    }

    this._isProcessing = true;
    this._currentStreamingMessage = undefined;

    // Add user message
    const userMessage: ChatMessage = {
      id: this._generateId(),
      type: "user",
      content: text,
      timestamp: new Date(),
    };

    this._messages.push(userMessage);
    this._updateWebview();

    try {
      // Show typing indicator
      this._view?.webview.postMessage({
        type: "setTyping",
        isTyping: true,
      });

      // Send message to Codex CLI (streaming will be handled by event listeners)
      await this._codexService.sendMessage(text);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: this._generateId(),
        type: "system",
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      };

      this._messages.push(errorMessage);
      this._updateWebview();
    } finally {
      this._isProcessing = false;
      this._currentStreamingMessage = undefined;
      this._view?.webview.postMessage({
        type: "setTyping",
        isTyping: false,
      });
    }
  }

  private async _handleExecutionApproval(
    requestId: string,
    approved: boolean,
  ): Promise<void> {
    try {
      await this._codexService.approveExecution(requestId, approved);

      const approvalMessage: ChatMessage = {
        id: this._generateId(),
        type: "system",
        content: `Execution ${approved ? "approved" : "denied"}`,
        timestamp: new Date(),
      };

      this._messages.push(approvalMessage);
      this._updateWebview();
    } catch (error) {
      console.error("Failed to send execution approval:", error);
    }
  }

  private _clearMessages() {
    this._messages = [];
    this._updateWebview();
  }


  private _addMessage(type: ChatMessage["type"], content: string): void {
    const message: ChatMessage = {
      id: this._generateId(),
      type,
      content,
      timestamp: new Date(),
    };
    this._messages.push(message);
  }

  private _updateWebview() {
    if (this._view) {
      this._view.webview.postMessage({
        type: "updateMessages",
        messages: this._messages,
      });
    }
  }

  private _handleGetChatHistory(): void {
    // For now, send back empty history
    // TODO: Implement actual chat history persistence
    this._view?.webview.postMessage({
      type: "chatHistory",
      sessions: []
    });
  }

  private _handleLoadChatSession(sessionId: string): void {
    // TODO: Implement loading chat session
    console.log("Load chat session:", sessionId);
  }

  private _handleDeleteChatSession(sessionId: string): void {
    // TODO: Implement deleting chat session
    console.log("Delete chat session:", sessionId);
  }

  private _handleGetSettings(): void {
    // TODO: Implement getting settings from workspace configuration
    const defaultSettings = {
      apiKey: "",
      model: "gpt-4",
      temperature: 0.7,
      maxTokens: 4000,
      autoSave: true,
      theme: "auto"
    };
    
    this._view?.webview.postMessage({
      type: "settings",
      settings: defaultSettings
    });
  }

  private _handleSaveSettings(settings: any): void {
    // TODO: Implement saving settings to workspace configuration
    console.log("Save settings:", settings);
    this._view?.webview.postMessage({
      type: "settingsSaved"
    });
  }

  private _handleResetSettings(): void {
    // TODO: Implement resetting settings
    console.log("Reset settings");
    this._handleGetSettings(); // Send back default settings
  }

  private _handleGetConfig(): void {
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

  private async _handleUpdateConfig(config: any): Promise<void> {
    try {
      await this._configManager.saveConfig(config);
      vscode.window.showInformationMessage(
        "Codexia configuration updated successfully!",
      );

      // Notify about config change
      vscode.commands.executeCommand("codexia.configChanged");
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async _handleResetConfig(): Promise<void> {
    try {
      await this._configManager.saveConfig({});
      this._handleGetConfig();
      vscode.window.showInformationMessage("Configuration reset to defaults!");
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to reset configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private _generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionContext.extensionUri, "out", "webview-ui", "assets", "main.js"),
    );
    const nonce = this._getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Codexia Chat</title>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }

  private _getNonce(): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
