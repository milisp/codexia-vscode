import * as vscode from "vscode";
import { ChatMessage } from "./chatTypes";
import { CodexService } from "./codexService";

export class ChatMessageHandler {
  constructor(
    private readonly _codexService: CodexService,
    private readonly _messages: ChatMessage[],
    private readonly _updateWebviewCallback: () => void,
    private readonly _generateIdCallback: () => string
  ) {}

  public async handleUserMessage(
    text: string,
    isProcessing: boolean,
    setProcessing: (processing: boolean) => void,
    setCurrentStreamingMessage: (message?: ChatMessage) => void,
    view?: vscode.WebviewView
  ): Promise<void> {
    if (isProcessing) {
      return;
    }

    setProcessing(true);
    setCurrentStreamingMessage(undefined);

    const userMessage: ChatMessage = {
      id: this._generateIdCallback(),
      type: "user",
      content: text,
      timestamp: new Date(),
    };

    this._messages.push(userMessage);
    this._updateWebviewCallback();

    try {
      view?.webview.postMessage({
        type: "setTyping",
        isTyping: true,
      });

      await this._codexService.sendMessage(text);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: this._generateIdCallback(),
        type: "system",
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      };

      this._messages.push(errorMessage);
      this._updateWebviewCallback();
    } finally {
      setProcessing(false);
      setCurrentStreamingMessage(undefined);
      view?.webview.postMessage({
        type: "setTyping",
        isTyping: false,
      });
    }
  }

  public async handleExecutionApproval(
    requestId: string, 
    approved: boolean,
    onProcessingStateChange?: (processing: boolean) => void,
    view?: any
  ): Promise<void> {
    try {
      const originalMessage = this._messages.find(msg => 
        msg.execRequestId === requestId && msg.type === "exec-request"
      );
      
      if (originalMessage && originalMessage.content.includes("Apply changes")) {
        const originalEventId = (originalMessage as any).originalEventId || requestId;
        const originalCallId = (originalMessage as any).originalCallId;
        console.log("Using original event_id for patch approval:", originalEventId);
        console.log("Original call_id was:", originalCallId);
        console.log("Message ID for UI tracking:", requestId);
        await this._codexService.approvePatch(originalEventId, approved);
      } else {
        // For exec approval, try event_id first, then call_id, then requestId
        const eventId = (originalMessage as any)?.originalEventId;
        const callId = (originalMessage as any)?.originalCallId; 
        const actualId = eventId || callId || requestId;
        console.log("Approving execution - requestId:", requestId, "eventId:", eventId, "callId:", callId, "using actualId:", actualId, "approved:", approved);
        await this._codexService.approveExecution(actualId, approved);
      }

      // Update UI state based on approval result
      if (!approved) {
        // If denied, clear the thinking/typing state
        onProcessingStateChange?.(false);
        view?.webview.postMessage({
          type: "setTyping",
          isTyping: false,
        });
      } else {
        // If approved, resume thinking state as execution continues
        onProcessingStateChange?.(true);
        view?.webview.postMessage({
          type: "setTyping",
          isTyping: true,
        });
      }

      // Don't show approval/denial confirmation messages - user action is self-evident
      this._updateWebviewCallback();
    } catch (error) {
      console.error("Failed to send approval:", error);
    }
  }

  public clearMessages(): void {
    this._messages.length = 0;
    this._updateWebviewCallback();
  }
}