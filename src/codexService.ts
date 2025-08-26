import * as vscode from "vscode";
import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { ConfigManager } from "./config";
import type {Submission, Event} from "./types/protocol"
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

  public async startSession(): Promise<void> {
    if (this._currentProcess && !this._currentProcess.killed) {
      return; // Already running
    }

    return new Promise((resolve, reject) => {
      try {
        // Get the working directory - use current workspace or fallback
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const workingDirectory: string =
          workspaceFolder?.uri.fsPath || process.cwd();

        // Build codex command with configuration
        const args = this._configManager.getCodexArgs(workingDirectory);
        args.push("proto"); // Add proto at the end

        console.log(
          "Starting codex with command:",
          ["codex", ...args].join(" "),
        );
        console.log("Working directory:", workingDirectory);

        // Start codex in protocol mode
        const childProcess = spawn("codex", args, {
          cwd: workingDirectory,
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env }, // Inherit environment variables
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
        this.removeListener("agent-message", onAgentMessage);
        this.removeListener("agent-message-delta", onAgentMessageDelta);
        this.removeListener("task-complete", onTaskComplete);
        this.removeListener("session-closed", onSessionClosed);
      };

      this.on("agent-message", onAgentMessage);
      this.on("agent-message-delta", onAgentMessageDelta);
      this.on("task-complete", onTaskComplete);
      this.on("session-closed", onSessionClosed);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!isComplete) {
          cleanup();
          reject(new Error("Request timeout"));
        }
      }, 30000);

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
        decision: approved ? "allow" : "deny",
      },
    };

    this._sendSubmission(submission);
  }

  public async interrupt(): Promise<void> {
    const submission: Submission = {
      id: generateId(),
      op: { type: "interrupt" },
    };

    this._sendSubmission(submission);
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
}
