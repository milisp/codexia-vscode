// Shared types between extension and webview-ui

export interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "exec-request" | "system";
  content: string;
  timestamp: Date | number; // Support both Date objects and timestamps
  execRequestId?: string;
}

export interface WorkingTask {
  id: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
}

export interface ChatSession {
  id: string;
  name: string;
  timestamp: number;
  messages: ChatMessage[];
}