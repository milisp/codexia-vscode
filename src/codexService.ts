import * as vscode from "vscode";
import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { ConfigManager } from "./config";
import type {Submission, Event} from "./types/protocol";
import { handleCodexEvent } from "./eventHandler";
import { generateId } from "./utils";

export class CodexService extends EventEmitter {
  private _currentProcess?: ChildProcess;
  private _sessionId?: string;
  private _isReady = false;
  private _configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    super();
    this._configManager = configManager;
  }

  public async startSession(minimal = false): Promise<void> {
    console.log(`=== StartSession Called (minimal: ${minimal}) ===`);
    console.log(`Current process exists: ${!!this._currentProcess}`);
    console.log(`Current process killed: ${this._currentProcess?.killed}`);
    console.log(`Session ready: ${this._isReady}`);
    
    if (this._currentProcess && !this._currentProcess.killed) {
      console.log("Session already running, skipping start");
      return; // Already running
    }

    return new Promise((resolve, reject) => {
      try {
        // Get the working directory - use current workspace or fallback
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const workingDirectory: string =
          workspaceFolder?.uri.fsPath || process.cwd();

        // Build codex command with configuration
        let args: string[];
        let env: NodeJS.ProcessEnv;
        
        if (minimal) {
          // Minimal mode - just basic proto mode
          args = ["proto"];
          env = { ...process.env };
          console.log("=== Using Minimal Mode ===");
        } else {
          // Full configuration mode
          args = this._configManager.getCodexArgs(workingDirectory);
          args.push("proto");
          env = this._configManager.getEnvironmentVariables();
        }
        
        console.log("=== Codex Startup Debug ===");
        console.log("Starting codex with command:", ["codex", ...args].join(" "));
        console.log("Working directory:", workingDirectory);
        console.log("Environment variables:", Object.keys(env).filter(k => k.includes('API') || k.includes('KEY')).map(k => `${k}=${env[k] ? '[SET]' : '[UNSET]'}`));
        console.log("Full args array:", args);
        const childProcess = spawn("codex", args, {
          cwd: workingDirectory,
          stdio: ["pipe", "pipe", "pipe"],
          env: env,
        });

        this._currentProcess = childProcess;

        let stdoutBuffer = "";

        childProcess.stdout?.on("data", (data: Buffer) => {
          const chunk = data.toString();
          stdoutBuffer += chunk;

          // Process complete lines
          const lines = stdoutBuffer.split("\n");
          stdoutBuffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              handleCodexEvent(this, line.trim());
            }
          }
        });

        childProcess.stderr?.on("data", (data: Buffer) => {
          console.error("Codex stderr:", data.toString());
        });

        childProcess.on("close", (code: number | null) => {
          console.log(`Codex process closed with code: ${code}`);
          this._isReady = false;
          this.emit("session-closed", code);
          
          // If process died unexpectedly (not code 0), attempt restart
          if (code !== 0 && code !== null) {
            console.log("Codex process died unexpectedly, attempting restart in 3 seconds...");
            setTimeout(() => {
              if (!this._isReady) {
                console.log("Attempting to restart Codex session...");
                this.startSession().catch(error => {
                  console.error("Failed to restart Codex session:", error);
                });
              }
            }, 3000);
          }
        });

        childProcess.on("error", (error: Error) => {
          console.error("Codex process error:", error);
          reject(error);
        });

        // Wait for session to be configured
        this.once("session-ready", () => {
          resolve();
        });

        // Timeout if session doesn't start within 10 seconds
        setTimeout(() => {
          if (!this._isReady) {
            this.stopSession();
            reject(new Error("Codex session timeout"));
          }
        }, 10000);
      } catch (error) {
        reject(
          new Error(
            `Failed to start codex session: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    });
  }

  private _sendSubmission(submission: Submission): void {
    if (!this._currentProcess || !this._isReady) {
      throw new Error("Codex session not ready");
    }

    const json = JSON.stringify(submission);
    // console.log("Sending to codex:", json);

    this._currentProcess.stdin?.write(json + "\n");
  }

  public async sendMessage(message: string): Promise<string> {
    if (!this._isReady) {
      await this.startSession();
    }

    return new Promise((resolve, reject) => {
      let responseContent = "";
      let isComplete = false;
      let hasApprovalRequest = false;

      const submission: Submission = {
        id: generateId(),
        op: {
          type: "user_input",
          items: [{ type: "text", text: message }],
        },
      };

      // Listen for agent response (complete message)
      const onAgentMessage = (content: string) => {
        if (!isComplete) {
          responseContent = content;
          isComplete = true;
          cleanup();
          resolve(responseContent);
        }
      };

      // Listen for streaming deltas
      const onAgentMessageDelta = (delta: string) => {
        responseContent += delta;
        // Emit delta for streaming UI updates
        this.emit("message-delta", delta);
      };

      const onSessionClosed = () => {
        if (!isComplete) {
          cleanup();
          reject(new Error("Session closed unexpectedly"));
        }
      };

      // Listen for approval requests to extend timeout
      const onApprovalRequest = () => {
        hasApprovalRequest = true;
      };

      // Listen for task completion (end of streaming)
      const onTaskComplete = (data: any) => {
        if (!isComplete) {
          // If we have accumulated content from deltas, use it
          if (responseContent) {
            isComplete = true;
            cleanup();
            resolve(responseContent);
          } else if (data.last_message) {
            // Fallback to last_message if available
            responseContent = data.last_message;
            isComplete = true;
            cleanup();
            resolve(responseContent);
          }
        }
      };

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        this.removeListener("agent-message", onAgentMessage);
        this.removeListener("agent-message-delta", onAgentMessageDelta);
        this.removeListener("task-complete", onTaskComplete);
        this.removeListener("session-closed", onSessionClosed);
        this.removeListener("exec-approval-request", onApprovalRequestWithTimeout);
        this.removeListener("patch-approval-request", onApprovalRequestWithTimeout);
      };

      this.on("agent-message", onAgentMessage);
      this.on("agent-message-delta", onAgentMessageDelta);
      this.on("task-complete", onTaskComplete);
      this.on("session-closed", onSessionClosed);

      // Initial timeout of 2 minutes, but extend if approval request comes in
      let timeoutId = setTimeout(() => {
        if (!isComplete && !hasApprovalRequest) {
          cleanup();
          reject(new Error("Request timeout"));
        }
      }, 120000); // 2 minutes initial timeout

      // Extend timeout when approval request is received
      const extendTimeout = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            if (!isComplete) {
              cleanup();
              reject(new Error("Approval timeout - no user response"));
            }
          }, 600000); // 10 minutes for user approval
        }
      };

      // Update approval request handler to extend timeout
      const onApprovalRequestWithTimeout = () => {
        hasApprovalRequest = true;
        extendTimeout();
      };

      this.on("exec-approval-request", onApprovalRequestWithTimeout);
      this.on("patch-approval-request", onApprovalRequestWithTimeout);

      try {
        this._sendSubmission(submission);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  public async approveExecution(
    requestId: string,
    approved: boolean,
  ): Promise<void> {
    const submission: Submission = {
      id: generateId(),
      op: {
        type: "exec_approval",
        id: requestId,
        decision: approved ? "approved" : "denied",
      },
    };

    console.log("Sending exec approval:", JSON.stringify(submission, null, 2));
    console.log("Exec approval - requestId:", requestId, "approved:", approved);
    this._sendSubmission(submission);
  }

  public async approvePatch(
    requestId: string,
    approved: boolean,
  ): Promise<void> {
    const submission: Submission = {
      id: generateId(),
      op: {
        type: "patch_approval",
        id: requestId,
        decision: approved ? "approved" : "denied",
      },
    };

    console.log("Sending patch approval:", JSON.stringify(submission, null, 2));
    this._sendSubmission(submission);
  }

  public async interrupt(): Promise<void> {
    const submission: Submission = {
      id: generateId(),
      op: { type: "interrupt" },
    };

    this._sendSubmission(submission);
  }

  public async getConversationHistory(): Promise<any> {
    const submission: Submission = {
      id: generateId(),
      op: { type: "get_history" },
    };

    return new Promise((resolve, reject) => {
      let resolved = false;
      
      const onConversationHistory = (data: any) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(data);
        }
      };

      const cleanup = () => {
        this.removeListener("conversation-history", onConversationHistory);
      };

      this.on("conversation-history", onConversationHistory);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!resolved) {
          cleanup();
          reject(new Error("Get conversation history timeout"));
        }
      }, 10000);

      try {
        this._sendSubmission(submission);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  public async forkConversation(conversationHistory: any[], dropLastMessages: number): Promise<any> {
    // First get current conversation history if not provided
    let historyToUse = conversationHistory;
    if (!historyToUse) {
      try {
        const historyData = await this.getConversationHistory();
        historyToUse = historyData.entries || [];
      } catch (error) {
        throw new Error(`Failed to get conversation history: ${error}`);
      }
    }

    // Calculate messages to keep (total - dropLastMessages)
    const messagesToKeep = Math.max(0, historyToUse.length - dropLastMessages);
    const truncatedHistory = historyToUse.slice(0, messagesToKeep);

    console.log(`Forking conversation: keeping ${messagesToKeep} messages, dropping last ${dropLastMessages} messages`);

    // For now, since the Codex CLI fork_conversation isn't directly exposed via protocol,
    // we'll restart the session and provide the truncated history as initial context
    await this.stopSession();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start new session 
    // Note: We'd need to modify the Codex spawn to accept initial_history parameter
    // For now, we'll just restart and notify about the intended resume point
    await this.startSession();
    
    return {
      success: true,
      keptMessages: messagesToKeep,
      droppedMessages: dropLastMessages,
      truncatedHistory: truncatedHistory
    };
  }

  public async resumeFromSession(sessionEntries: any[], sessionName: string): Promise<any> {
    console.log(`Resuming from session: ${sessionName} with ${sessionEntries.length} entries`);
    
    // Stop current session
    await this.stopSession();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start new session 
    await this.startSession();
    
    // For now, we can't directly load history into Codex CLI via protocol
    // But we can provide a summary of what we're trying to restore
    const userMessages = sessionEntries.filter(entry => 
      entry.role === 'user' || 
      (entry.type === 'user_input' && entry.items)
    ).length;
    
    const assistantMessages = sessionEntries.filter(entry => 
      entry.role === 'assistant' || 
      entry.type === 'agent_message'
    ).length;
    
    return {
      success: true,
      sessionName,
      totalEntries: sessionEntries.length,
      userMessages,
      assistantMessages,
      entries: sessionEntries
    };
  }

  public async stopSession(): Promise<void> {
    if (this._currentProcess && !this._currentProcess.killed) {
      // Send graceful shutdown
      try {
        const submission: Submission = {
          id: generateId(),
          op: { type: "shutdown" },
        };
        this._sendSubmission(submission);
      } catch {
        // Ignore errors during shutdown
      }

      // Give it a moment to shutdown gracefully
      setTimeout(() => {
        if (this._currentProcess && !this._currentProcess.killed) {
          this._currentProcess.kill("SIGTERM");
        }
      }, 1000);
    }

    this._isReady = false;
    this._sessionId = undefined;
    this._currentProcess = undefined;
  }

  public isSessionReady(): boolean {
    return this._isReady;
  }

  public getSessionId(): string | undefined {
    return this._sessionId;
  }

  public async restartSession(minimal = false): Promise<void> {
    console.log(`Manual session restart requested (minimal: ${minimal})`);
    await this.stopSession();
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.startSession(minimal);
  }
}
