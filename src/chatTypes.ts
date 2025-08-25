export interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "system" | "exec-request";
  content: string;
  timestamp: Date;
  execRequestId?: string;
}
