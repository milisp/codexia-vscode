import * as vscode from "vscode";
import { CodexService } from "./codexService";
import { ConfigManager } from "./config";
import { ChatMessage } from "./chatTypes";
import { ChatEventHandlers } from "./chatEventHandlers";
import { ChatMessageHandler } from "./chatMessageHandler";
import { ContextManager } from "./contextManager";
import { SessionHistoryService, ParsedSession } from "./sessionHistoryService";
import * as path from "path";

export class ChatProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codexia.chatView";

  private _view?: vscode.WebviewView;
  private _isProcessing = false;
  private _currentStreamingMessage?: ChatMessage;
  private _eventHandlers: ChatEventHandlers;
  private _messageHandler: ChatMessageHandler;

  constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _codexService: CodexService,
    private readonly _configManager: ConfigManager,
    private readonly _contextManager: ContextManager,
    private readonly _sessionHistoryService?: SessionHistoryService,
  ) {
    this._eventHandlers = new ChatEventHandlers(
      this._codexService,
      () => this._updateWebview(),
      () => this._generateId(),
      (processing: boolean) => { this._isProcessing = processing; },
      undefined // Will be set in resolveWebviewView
    );
    
    this._messageHandler = new ChatMessageHandler(
      this._codexService,
      this._eventHandlers.messages,
      () => this._updateWebview(),
      () => this._generateId()
    );

    // Listen for context changes and update webview
    this._contextManager.onDidChangeContext(() => {
      console.log("[ChatProvider] Context changed, updating webview");
      this._handleGetContextFiles();
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    this._eventHandlers.setView(webviewView);

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
            this._messageHandler.clearMessages();
            break;
          case "approveExecution":
            this._handleExecutionApproval(message.execRequestId, message.approved);
            break;
          case "restartSession":
            this._handleRestartSession();
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
          case "getContextFiles":
            this._handleGetContextFiles();
            break;
          case "removeContextFile":
            this._handleRemoveContextFile(message.path);
            break;
          case "getContextContent":
            this._handleGetContextContent(message.files);
            break;
          case "getConversationHistory":
            this._handleGetConversationHistory();
            break;
          case "resumeConversation":
            this._handleResumeConversation(message.conversationId, message.dropLastMessages);
            break;
          case "loadSessionFromHistory":
            this._handleLoadSessionFromHistory(message.sessionId, message.sessionEntries, message.sessionName);
            break;
          case "getSessionHistory":
            this._handleGetSessionHistory();
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
      this._messageHandler.clearMessages();
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

    // Don't show "Configuration updated" message in chat
  }

  public clearHistory() {
    this._messageHandler.clearMessages();
    this._codexService.stopSession();
  }

  public showSessionHistory(sessions: ParsedSession[]) {
    console.log('[ChatProvider] showSessionHistory called with', sessions.length, 'sessions');
    
    if (this._view) {
      this._view.show?.(true);
      
      // First, tell the frontend to show the history view
      this._view.webview.postMessage({
        type: "showHistory",
      });
      
      // Convert sessions to the format expected by the webview
      const sessionData = sessions.map(session => ({
        id: session.sessionId,
        name: session.name,
        timestamp: session.timestamp.getTime(),
        messageCount: session.messageCount,
        entries: session.entries
      }));

      console.log('[ChatProvider] Sending session data to webview:', sessionData.length, 'sessions');
      
      // Then send the session data
      this._view.webview.postMessage({
        type: "showSessionHistory",
        sessions: sessionData
      });
    } else {
      console.log('[ChatProvider] No webview available to show session history');
    }
  }

  private _setupCodexEventListeners(): void {
    // Use only agent-message-delta for streaming
    this._codexService.on("agent-message-delta", (delta: string) => {
      this._eventHandlers.onAgentMessageDelta(delta);
    });

    // Only use complete messages as fallback
    this._codexService.on("agent-message", (message: string) => {
      // Only use if no streaming message is active
      if (!this._currentStreamingMessage) {
        this._eventHandlers.onAgentMessage(message);
      }
    });

    this._codexService.on(
      "exec-approval-request",
      (request: { event_id: string; call_id: string; command: string | string[]; cwd: string; reason?: string }) => {
        console.log("ChatProvider: exec-approval-request received:", request);
        this._eventHandlers.onExecApprovalRequest(request);
      },
    );

    this._codexService.on(
      "patch-approval-request",
      (request: { event_id: string; call_id: string; changes: any; reason?: string; grant_root?: string }) => {
        console.log("ChatProvider: patch-approval-request received:", request);
        this._eventHandlers.onPatchApprovalRequest(request);
      },
    );

    this._codexService.on(
      "patch-apply-begin",
      (event: { call_id: string; auto_approved: boolean; changes: any }) => {
        console.log("ChatProvider: patch-apply-begin received:", event);
        this._eventHandlers.onPatchApplyBegin(event);
      },
    );

    this._codexService.on(
      "patch-apply-end",
      (event: { call_id: string; stdout: string; stderr: string; success: boolean }) => {
        console.log("ChatProvider: patch-apply-end received:", event);
        this._eventHandlers.onPatchApplyEnd(event);
      },
    );

    this._codexService.on(
      "background-event",
      (event: { message: string }) => {
        console.log("ChatProvider: background-event received:", event);
        this._eventHandlers.onBackgroundEvent(event);
      },
    );

    this._codexService.on(
      "error-event",
      (event: { type: string; message: string; details: any }) => {
        console.log("ChatProvider: error-event received:", event);
        this._onErrorEvent(event);
      },
    );

    // Temporary: Listen for any codex events we might have missed
    this._codexService.on(
      "codex-event",
      (event: any) => {
        console.log("ChatProvider: unhandled codex event:", event);
        // Don't show unhandled events in chat - they're just debugging noise
      },
    );

    this._codexService.on(
      "exec-begin",
      (event: { call_id: string; command: string | string[]; cwd: string }) => {
        console.log("ChatProvider: exec-begin received:", event);
        this._eventHandlers.onExecBegin(event);
      },
    );

    this._codexService.on(
      "exec-output",
      (output: { call_id: string; stream: string; chunk: string }) => {
        console.log("ChatProvider: exec-output received:", output);
        this._eventHandlers.onExecOutput(output);
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
        this._eventHandlers.onExecComplete(result);
      },
    );

    this._codexService.on(
      "task-complete",
      (completion: { last_message: string }) => {
        console.log("ChatProvider: task-complete received:", completion);
        this._eventHandlers.onTaskComplete(completion);
      },
    );

    this._codexService.on("session-closed", () => {
      console.log("ChatProvider: session-closed received");
      this._onSessionClosed();
    });

    this._codexService.on("shutdown-complete", () => {
      console.log("ChatProvider: shutdown-complete received");
      this._onShutdownComplete();
    });
  }


  private _onSessionClosed(): void {
    this._isProcessing = false;
    this._currentStreamingMessage = undefined;
    this._eventHandlers.clearState();
    this._view?.webview.postMessage({
      type: "setTyping",
      isTyping: false,
    });
  }

  private _onShutdownComplete(): void {
    console.log("Codex session shut down");
    this._isProcessing = false;
    this._currentStreamingMessage = undefined;
    this._eventHandlers.clearState();
    
    // Don't show "Codex session restarted" message in chat
    this._updateWebview();
    
    this._view?.webview.postMessage({
      type: "setTyping",
      isTyping: false,
    });
  }

  private _onErrorEvent(event: { type: string; message: string; details: any }): void {
    console.log("ChatProvider: Processing error event:", event);
    
    // Clear processing state on errors
    this._isProcessing = false;
    this._currentStreamingMessage = undefined;
    this._eventHandlers.clearState();
    
    // Show appropriate error message based on error type
    let errorMessage = "";
    if (event.type === "stream_error") {
      errorMessage = "🔌 Connection error - please try again";
    } else if (event.type === "error") {
      if (event.message.includes("429") || event.message.includes("rate limit")) {
        errorMessage = "⏳ Rate limit reached - please wait before trying again";
      } else if (event.message.includes("authentication") || event.message.includes("auth")) {
        errorMessage = "🔐 Authentication error - please check your API configuration";
      } else {
        errorMessage = `❌ Error: ${event.message}`;
      }
    } else {
      errorMessage = `❌ ${event.type}: ${event.message}`;
    }
    
    this._eventHandlers.onBackgroundEvent({ message: errorMessage });
    
    this._view?.webview.postMessage({
      type: "setTyping",
      isTyping: false,
    });
  }

  private async _handleUserMessage(text: string) {
    await this._messageHandler.handleUserMessage(
      text,
      this._isProcessing,
      (processing: boolean) => { this._isProcessing = processing; },
      (message?: ChatMessage) => { this._currentStreamingMessage = message; },
      this._view
    );
  }

  private async _handleExecutionApproval(
    requestId: string,
    approved: boolean,
  ): Promise<void> {
    await this._messageHandler.handleExecutionApproval(
      requestId, 
      approved,
      (processing: boolean) => { this._isProcessing = processing; },
      this._view
    );
  }

  private _updateWebview() {
    if (this._view) {
      this._view.webview.postMessage({
        type: "updateMessages",
        messages: this._eventHandlers.messages,
      });
    }
  }


  private _handleGetConfig(): void {
    console.log("=== GetConfig Called ===");
    console.log("Stack trace:", new Error().stack);
    
    const config = this._configManager.getConfig();
    const modelOptions = ConfigManager.getModelOptions();
    const providers = ConfigManager.getProviderOptions();
    const approvalPolicies = ConfigManager.getApprovalPolicyOptions();
    const sandboxModes = ConfigManager.getSandboxModeOptions();
    const providerEnvVars = ConfigManager.getProviderEnvVars();

    console.log("Sending config data:", config);

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
      console.log("=== Config Update Started ===");
      console.log("New config:", config);
      
      await this._configManager.saveConfig(config);
      
      // Don't add system message about configuration update to chat

      console.log("Stopping current session...");
      await this._codexService.stopSession();
      
      console.log("Waiting 2 seconds before restart...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log("Starting new session...");
      await this._codexService.startSession();
      
      console.log("Session restart complete");
      // Notify about config change
      vscode.commands.executeCommand("codexia.configChanged");
    } catch (error) {
      console.error("Config update failed:", error);
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

  private async _handleRestartSession(): Promise<void> {
    try {
      // Don't show restart messages in chat
      await this._codexService.restartSession();
    } catch (error) {
      // Use notification instead of chat message for restart failures
      vscode.window.showErrorMessage(`Failed to restart session: ${error instanceof Error ? error.message : String(error)}`);
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

  private _handleGetContextFiles(): void {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const contextFiles = this._contextManager.getContextFiles().map(filePath => ({
      path: filePath,
      relativePath: workspaceRoot ? path.relative(workspaceRoot, filePath) : path.basename(filePath),
      name: path.basename(filePath)
    }));

    this._view?.webview.postMessage({
      type: "contextFilesData",
      files: contextFiles
    });
  }

  private _handleRemoveContextFile(filePath: string): void {
    this._contextManager.removeFile(filePath);
  }

  private _handleGetContextContent(files: string[]): void {
    const contextContent = this._contextManager.getContextContent();
    // For now, we'll send the content back to the webview
    // The webview can then include it in the message
    this._view?.webview.postMessage({
      type: "contextContentData",
      content: contextContent
    });
  }

  private async _handleGetConversationHistory(): Promise<void> {
    try {
      const historyData = await this._codexService.getConversationHistory();
      this._view?.webview.postMessage({
        type: "conversationHistoryData",
        data: historyData
      });
    } catch (error) {
      console.error("Failed to get conversation history:", error);
      this._view?.webview.postMessage({
        type: "conversationHistoryData",
        data: null,
        error: error instanceof Error ? error.message : "Failed to get conversation history"
      });
    }
  }

  private async _handleGetSessionHistory(): Promise<void> {
    try {
      console.log('[ChatProvider] Getting session history...');
      if (!this._sessionHistoryService) {
        throw new Error("Session history service not available");
      }

      const sessions = await this._sessionHistoryService.getAllSessions(20);
      console.log(`[ChatProvider] Retrieved ${sessions.length} sessions`);

      // Convert sessions to the format expected by the webview
      const sessionData = sessions.map(session => ({
        id: session.sessionId,
        name: session.name,
        timestamp: session.timestamp.getTime(),
        messageCount: session.messageCount,
        entries: session.entries
      }));

      this._view?.webview.postMessage({
        type: "showSessionHistory",
        sessions: sessionData
      });
    } catch (error) {
      console.error("Failed to get session history:", error);
      this._view?.webview.postMessage({
        type: "showSessionHistory",
        sessions: [],
        error: error instanceof Error ? error.message : "Failed to get session history"
      });
    }
  }

  private async _handleResumeConversation(conversationId: string, dropLastMessages: number): Promise<void> {
    try {
      console.log(`Starting resume conversation: conversationId=${conversationId}, dropLastMessages=${dropLastMessages}`);
      
      // Clear current messages
      this._messageHandler.clearMessages();
      
      // Show progress message
      this._eventHandlers.onBackgroundEvent({
        message: `🔄 Resuming conversation by dropping last ${dropLastMessages} messages...`
      });
      
      // Fork the conversation
      const forkResult = await this._codexService.forkConversation([], dropLastMessages);
      
      if (forkResult.success) {
        this._eventHandlers.onBackgroundEvent({
          message: `✅ Successfully resumed conversation! Kept ${forkResult.keptMessages} messages, dropped ${forkResult.droppedMessages} messages.`
        });
      } else {
        throw new Error("Fork conversation returned unsuccessful result");
      }
      
    } catch (error) {
      console.error("Failed to resume conversation:", error);
      this._eventHandlers.onBackgroundEvent({
        message: `❌ Failed to resume conversation: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    }
  }

  private async _handleLoadSessionFromHistory(sessionId: string, sessionEntries: any[], sessionName: string): Promise<void> {
    try {
      console.log(`Loading session from history: ${sessionName} (${sessionId})`);
      
      // Clear current messages
      this._messageHandler.clearMessages();
      
      // Show progress message
      this._eventHandlers.onBackgroundEvent({
        message: `🔄 Loading session "${sessionName}" with ${sessionEntries.length} entries...`
      });
      
      // Resume from session
      const resumeResult = await this._codexService.resumeFromSession(sessionEntries, sessionName);
      
      if (resumeResult.success) {
        this._eventHandlers.onBackgroundEvent({
          message: `✅ Successfully loaded session "${sessionName}"! Found ${resumeResult.userMessages} user messages and ${resumeResult.assistantMessages} assistant messages.`
        });
        
        // Add some context about what was loaded
        this._eventHandlers.onBackgroundEvent({
          message: `📋 Session context loaded. You can now continue the conversation from where it left off. Note: Due to current limitations, the full conversation history may not be immediately visible, but the session context should be available.`
        });
      } else {
        throw new Error("Resume from session returned unsuccessful result");
      }
      
    } catch (error) {
      console.error("Failed to load session from history:", error);
      this._eventHandlers.onBackgroundEvent({
        message: `❌ Failed to load session: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    }
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
