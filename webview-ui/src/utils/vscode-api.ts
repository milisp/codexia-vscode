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
  type: "updateMessages" | "setTyping" | "focusInput" | "updateWorkingTasks" | "chatHistory" | "settings" | "settingsSaved" | "configData" | "showSettings" | "hideSettings";
  messages?: ChatMessage[];
  isTyping?: boolean;
  tasks?: WorkingTask[];
  sessions?: ChatSession[];
  settings?: any;
  config?: any;
  modelOptions?: { [provider: string]: string[] };
  providers?: string[];
  approvalPolicies?: string[];
  sandboxModes?: string[];
  providerEnvVars?: { [provider: string]: string[] };
}

export interface MessageToExtension {
  type: "sendMessage" | "clearChat" | "approveExecution" | "getChatHistory" | "loadChatSession" | "deleteChatSession" | "getSettings" | "saveSettings" | "resetSettings" | "getConfig" | "updateConfig" | "resetConfig";
  text?: string;
  execRequestId?: string;
  approved?: boolean;
  sessionId?: string;
  settings?: any;
  config?: any;
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