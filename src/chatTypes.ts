export interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "system" | "exec-request";
  content: string;
  timestamp: Date;
  execRequestId?: string;
}

export interface ExecCell {
  id: string;
  commands: string[];
}

export interface RunningCommand {
  call_id: string;
  command: string | string[];
  cwd: string;
}