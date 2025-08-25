import * as vscode from "vscode";
import * as path from "path";
import { CodexService } from "./codexService";

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
  private _needsRedraw = false;

  constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _codexService: CodexService,
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
            this._handleExecutionApproval(message.requestId, message.approved);
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
      this._view.webview.postMessage({
        type: "focusInput",
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
    this._updateWebview();
  }

  public clearHistory() {
    this._clearMessages();
    this._codexService.stopSession();
  }

  private _setupCodexEventListeners(): void {
    // Prioritize delta streaming for all messages
    this._codexService.on("agent-message-delta", (delta: string) => {
      console.log("ChatProvider: agent-message-delta received:", delta);
      this._onAgentMessageDelta(delta);
    });

    this._codexService.on("message-delta", (delta: string) => {
      console.log("ChatProvider: message-delta received:", delta);
      this._onAgentMessageDelta(delta);
    });

    // Only use complete messages as fallback
    this._codexService.on("agent-message", (message: string) => {
      console.log("ChatProvider: agent-message received (fallback):", message);
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

  // Unified event handler following Rust implementation pattern
  private _handleCodexEvent(event: any): void {
    // Reset redraw flag for this dispatch
    this._needsRedraw = false;

    if (!event.msg) {
      return;
    }

    switch (event.msg.type) {
      case "agent_message":
        this._onAgentMessage(event.msg.message || "");
        break;
      case "agent_message_delta":
        this._onAgentMessageDelta(event.msg.delta || "");
        break;
      case "exec_request":
        this._onExecRequest({
          id: event.msg.id || "",
          command: event.msg.command || "",
        });
        break;
      case "exec_command_begin":
        this._onExecCommandBegin(event.msg);
        break;
      case "exec_command_output_delta":
        this._onExecOutput({
          call_id: event.msg.call_id || "",
          stream: event.msg.stream || "",
          chunk: event.msg.chunk ? String.fromCharCode(...event.msg.chunk) : "",
        });
        break;
      case "exec_command_end":
        this._onExecComplete({
          call_id: event.msg.call_id || "",
          stdout: event.msg.stdout || "",
          stderr: event.msg.stderr || "",
          exit_code: event.msg.exit_code || 0,
        });
        break;
      case "task_complete":
        this._onTaskComplete({
          last_message: event.msg.last_agent_message || "",
        });
        break;
      default:
        console.log("Unhandled event type:", event.msg.type, event);
    }

    // Coalesce redraws: issue at most one after handling the event
    if (this._needsRedraw) {
      this._requestRedraw();
      this._needsRedraw = false;
    }
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
    console.log("ChatProvider: _onAgentMessageDelta called with:", delta);
    if (!this._currentStreamingMessage) {
      // Start new streaming message
      this._currentStreamingMessage = {
        id: this._generateId(),
        type: "assistant",
        content: delta,
        timestamp: new Date(),
      };
      this._messages.push(this._currentStreamingMessage);
      console.log(
        "ChatProvider: Started new streaming message with delta:",
        delta,
      );
    } else {
      // Update existing streaming message
      this._currentStreamingMessage.content += delta;
      console.log(
        "ChatProvider: Updated streaming message, total content:",
        this._currentStreamingMessage.content,
      );
    }
    // Immediately update UI
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
    // Immediately update UI
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
    this._messages.push(resultMessage);
    // Immediately update UI
    this._updateWebview();
  }

  private _onTaskComplete(completion: { last_message: string }): void {
    console.log("ChatProvider: _onTaskComplete called with:", completion);
    this._isProcessing = false;
    this._currentStreamingMessage = undefined;
    this._runningCommands.clear();
    this._activeExecCell = undefined;

    // Don't add a separate completion message if we already have the response
    if (!completion.last_message || !this._currentStreamingMessage) {
      const completionMessage: ChatMessage = {
        id: this._generateId(),
        type: "system",
        content: "Task completed successfully!",
        timestamp: new Date(),
      };
      this._messages.push(completionMessage);
    }

    // Immediately update UI
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

  // UI update methods following Rust implementation pattern
  private _markNeedsRedraw(): void {
    this._needsRedraw = true;
  }

  private _requestRedraw(): void {
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
      console.log(
        "ChatProvider: Updating webview with",
        this._messages.length,
        "messages",
      );
      console.log("ChatProvider: Latest messages:", this._messages.slice(-2));
      this._view.webview.postMessage({
        type: "updateMessages",
        messages: this._messages,
      });
    } else {
      console.log("ChatProvider: No webview available to update");
    }
  }

  private _generateId(): string {
    return Math.random().toString(36).substr(2, 9);
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
        "main.css",
      ),
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionContext.extensionUri,
        "media",
        "main.js",
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
				<title>Codexia Chat</title>
			</head>
			<body>
				<div class="container">
					<div class="working-section" id="workingSection" style="display: none;">
						<h3>Working</h3>
						<ul id="workingList">
						</ul>
					</div>

					<div class="messages-container" id="messagesContainer">
						<!-- Messages will be inserted here -->
					</div>

					<div class="input-container">
						<div class="input-wrapper">
							<textarea 
								id="messageInput" 
								placeholder="Ask Codexia to do anything"
								rows="1"
							></textarea>
							<button id="sendButton" class="send-button">
								<span class="send-icon">▶</span>
							</button>
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
}
