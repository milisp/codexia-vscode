// VSCode API utilities
declare global {
  interface Window {
    acquireVsCodeApi(): {
      postMessage: (message: any) => void;
      setState: (state: any) => void;
      getState: () => any;
    };
  }
}

export const vscode = window.acquireVsCodeApi();

import { ChatMessage, WorkingTask, ChatSession } from '../types/shared';

export interface MessageFromExtension {
  type: "updateMessages" | "setTyping" | "focusInput" | "updateWorkingTasks" | "chatHistory" | "settings" | "settingsSaved";
  messages?: ChatMessage[];
  isTyping?: boolean;
  tasks?: WorkingTask[];
  sessions?: ChatSession[];
  settings?: any;
}

export interface MessageToExtension {
  type: "sendMessage" | "clearChat" | "approveExecution" | "getChatHistory" | "loadChatSession" | "deleteChatSession" | "getSettings" | "saveSettings" | "resetSettings";
  text?: string;
  execRequestId?: string;
  approved?: boolean;
  sessionId?: string;
  settings?: any;
}

export type { ChatMessage, WorkingTask, ChatSession };

export const postMessage = (message: MessageToExtension) => {
  vscode.postMessage(message);
};

export const setupMessageListener = (callback: (message: MessageFromExtension) => void) => {
  const handler = (event: MessageEvent) => {
    callback(event.data);
  };
  
  window.addEventListener("message", handler);
  
  return () => {
    window.removeEventListener("message", handler);
  };
};