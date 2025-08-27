import * as vscode from "vscode";
import { ChatMessage, ExecCell, RunningCommand } from "./chatTypes";
import { CodexService } from "./codexService";

export class ChatEventHandlers {
  private _messages: ChatMessage[] = [];
  private _currentStreamingMessage?: ChatMessage;
  private _activeExecCell?: ExecCell;
  private _runningCommands: Map<string, RunningCommand> = new Map();

  constructor(
    private readonly _codexService: CodexService,
    private readonly _updateWebviewCallback: () => void,
    private readonly _generateIdCallback: () => string,
    private readonly _onProcessingStateChange?: (processing: boolean) => void,
    private readonly _view?: any
  ) {}

  public get messages(): ChatMessage[] {
    return this._messages;
  }

  public set messages(messages: ChatMessage[]) {
    this._messages = messages;
  }

  public clearState(): void {
    this._currentStreamingMessage = undefined;
    this._runningCommands.clear();
    this._activeExecCell = undefined;
  }

  public clearMessages(): void {
    console.log("ChatEventHandlers: Clearing all messages");
    this._messages = [];
    this.clearState();
  }

  public setView(view: any): void {
    (this as any)._view = view;
  }

  public onAgentMessage(message: string): void {
    console.log("ChatEventHandlers: _onAgentMessage called with:", message);
    if (this._currentStreamingMessage) {
      this._currentStreamingMessage.content = message;
    } else {
      this._addMessage("assistant", message);
    }
    this._updateWebviewCallback();
  }

  public onAgentMessageDelta(delta: string): void {
    if (!this._currentStreamingMessage) {
      this._currentStreamingMessage = {
        id: this._generateIdCallback(),
        type: "assistant",
        content: delta,
        timestamp: new Date(),
      };
      this._messages.push(this._currentStreamingMessage);
    } else {
      this._currentStreamingMessage.content += delta;
    }
    this._updateWebviewCallback();
  }

  public onExecApprovalRequest(request: { event_id: string; call_id: string; command: string | string[]; cwd: string; reason?: string }): void {
    console.log("onExecApprovalRequest - event_id:", request.event_id, "call_id:", request.call_id, "command:", request.command);
    const command = Array.isArray(request.command) ? request.command.join(' ') : request.command;
    const content = `Execute command: ${command}${request.reason ? `\n\nReason: ${request.reason}` : ''}`;
    
    // Use event_id as the primary identifier (similar to patch approval)
    const messageId = this._generateIdCallback();
    const execRequestId = request.event_id || request.call_id || messageId;
    
    const approvalMessage: ChatMessage = {
      id: messageId,
      type: "exec-request",
      content,
      timestamp: new Date(),
      execRequestId: messageId, // Use messageId for UI tracking
    };
    
    // Store the actual event_id and call_id for approval
    (approvalMessage as any).originalEventId = request.event_id;
    (approvalMessage as any).originalCallId = request.call_id;
    
    console.log("Created approval message - messageId:", messageId, "event_id:", request.event_id, "call_id:", request.call_id);
    this._messages.push(approvalMessage);

    // Clear thinking state when waiting for user approval
    this._onProcessingStateChange?.(false);
    this._view?.webview.postMessage({
      type: "setTyping",
      isTyping: false,
    });

    this._updateWebviewCallback();
  }

  public onPatchApprovalRequest(request: { event_id: string; call_id: string; changes: any; reason?: string; grant_root?: string }): void {
    let content = "Apply code changes";
    
    if (request.changes && typeof request.changes === 'object') {
      const fileCount = Object.keys(request.changes).length;
      const fileNames = Object.keys(request.changes).join(', ');
      content = `Apply changes to ${fileCount} file(s): ${fileNames}`;
    }
    
    if (request.reason) {
      content += `\n\nReason: ${request.reason}`;
    }
    
    if (request.grant_root) {
      content += `\n\nThis will grant write access to: ${request.grant_root}`;
    }
    
    const messageId = this._generateIdCallback();
    
    const approvalMessage: ChatMessage = {
      id: messageId,
      type: "exec-request",
      content,
      timestamp: new Date(),
      execRequestId: messageId,
    };
    
    (approvalMessage as any).originalEventId = request.event_id;
    (approvalMessage as any).originalCallId = request.call_id;
    
    this._messages.push(approvalMessage);

    // Clear thinking state when waiting for user approval
    this._onProcessingStateChange?.(false);
    this._view?.webview.postMessage({
      type: "setTyping",
      isTyping: false,
    });

    this._updateWebviewCallback();
  }

  public onPatchApplyBegin(event: { call_id: string; auto_approved: boolean; changes: any }): void {
    let content = "Applying code changes...";
    
    if (event.changes && typeof event.changes === 'object') {
      const fileCount = Object.keys(event.changes).length;
      const fileNames = Object.keys(event.changes).join(', ');
      content = `Applying changes to ${fileCount} file(s): ${fileNames}...`;
    }
    
    if (event.auto_approved) {
      content += " (auto-approved)";
    }
    
    const applyMessage: ChatMessage = {
      id: this._generateIdCallback(),
      type: "system",
      content,
      timestamp: new Date(),
    };
    this._messages.push(applyMessage);
    this._updateWebviewCallback();
  }

  public onPatchApplyEnd(event: { call_id: string; stdout: string; stderr: string; success: boolean }): void {
    let content = event.success ? "✅ Code changes applied successfully" : "❌ Failed to apply code changes";
    
    if (event.stdout) {
      content += `\n\nOutput:\n${event.stdout}`;
    }
    
    if (event.stderr) {
      content += `\n\nError:\n${event.stderr}`;
    }
    
    const resultMessage: ChatMessage = {
      id: this._generateIdCallback(),
      type: "system",
      content,
      timestamp: new Date(),
    };
    this._messages.push(resultMessage);
    this._updateWebviewCallback();
  }

  public onBackgroundEvent(event: { message: string }): void {
    let content = `ℹ️ ${event.message}`;
    
    if (event.message.includes("429") || event.message.includes("Too Many Requests")) {
      content = `⚠️ Rate limit exceeded. Please wait before trying again.\n\nDetails: ${event.message}`;
    } else if (event.message.includes("stream error")) {
      content = `⚠️ Connection issue: ${event.message}`;
    }
    
    const backgroundMessage: ChatMessage = {
      id: this._generateIdCallback(),
      type: "system",
      content,
      timestamp: new Date(),
    };
    this._messages.push(backgroundMessage);
    this._updateWebviewCallback();
  }

  public onExecBegin(event: { call_id: string; command: string | string[]; cwd: string }): void {
    console.log("ChatEventHandlers: onExecBegin called with:", event);
    
    // Find and mark the corresponding exec-request message as executed
    const command = Array.isArray(event.command) ? event.command.join(' ') : event.command;
    const execRequestMessage = this._messages.find(msg => 
      msg.type === "exec-request" && 
      msg.content.includes(command)
    );
    
    if (execRequestMessage) {
      console.log("ChatEventHandlers: Found exec-request message to mark as executed:", execRequestMessage.id);
      (execRequestMessage as any).executed = true;
    }
    
    const beginMessage: ChatMessage = {
      id: this._generateIdCallback(),
      type: "system",
      content: `🔧 Executing: ${command}`,
      timestamp: new Date(),
    };
    
    this._messages.push(beginMessage);
    this._runningCommands.set(event.call_id, {
      call_id: event.call_id,
      command: event.command,
      cwd: event.cwd,
    });
    
    this._updateWebviewCallback();
  }

  public onExecOutput(output: { call_id: string; stream: string; chunk: string }): void {
    // Don't show raw command output in chat - it's usually just noise
    // Command results will be shown in onExecComplete if needed
  }

  public onExecComplete(result: { call_id: string; stdout: string; stderr: string; exit_code: number }): void {
    console.log("ChatEventHandlers: onExecComplete called with:", result);
    this._runningCommands.delete(result.call_id);

    if (this._runningCommands.size === 0) {
      this._activeExecCell = undefined;
    }

    // Show command completion message
    let content = "";
    if (result.exit_code === 0) {
      content = "✅ Command executed successfully";
      if (result.stdout && result.stdout.trim()) {
        content += `\n\nOutput:\n${result.stdout.trim()}`;
      }
    } else {
      content = `❌ Command failed with exit code ${result.exit_code}`;
      if (result.stderr && result.stderr.trim()) {
        content += `\n\nError:\n${result.stderr.trim()}`;
      }
      if (result.stdout && result.stdout.trim()) {
        content += `\n\nOutput:\n${result.stdout.trim()}`;
      }
    }

    const resultMessage: ChatMessage = {
      id: this._generateIdCallback(),
      type: "system",
      content,
      timestamp: new Date(),
    };
    this._messages.push(resultMessage);
    
    this._updateWebviewCallback();
  }

  public onTaskComplete(completion: { last_message: string }): void {
    console.log("ChatEventHandlers: onTaskComplete called with:", completion);
    
    this._runningCommands.clear();
    this._activeExecCell = undefined;

    if (completion.last_message) {
      if (this._currentStreamingMessage) {
        // Update the existing streaming message
        this._currentStreamingMessage.content = completion.last_message;
      } else {
        // No streaming message exists, create a new one
        console.log("ChatEventHandlers: No streaming message, creating new message for:", completion.last_message);
        this._addMessage("assistant", completion.last_message);
      }
    }
    
    this._currentStreamingMessage = undefined;
    this._onProcessingStateChange?.(false);
    this._updateWebviewCallback();
  }

  private _addMessage(type: ChatMessage["type"], content: string): void {
    const message: ChatMessage = {
      id: this._generateIdCallback(),
      type,
      content,
      timestamp: new Date(),
    };
    this._messages.push(message);
  }
}