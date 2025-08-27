// protocolTypes.ts
export interface Submission {
  id: string;
  op: Operation;
}

export interface Operation {
  type: string;
  items?: InputItem[];
  id?: string;
  decision?: string;
}

export interface InputItem {
  type: string;
  text?: string;
  image_url?: string;
  path?: string;
}

export interface Event {
  id: string;
  timestamp: string;
  msg: EventMsg;
}

export interface EventMsg {
  type: string;
  session_id?: string;
  model?: string;
  message?: string;
  last_agent_message?: string;
  delta?: string;
  id?: string;
  command?: string | string[];
  call_id?: string;
  stream?: string;
  chunk?: number[];
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  unified_diff?: string;
  cwd?: string;
  reason?: string;
  conversation_id?: string;
  entries?: ResponseItem[];
  [key: string]: any;
}

export interface ResponseItem {
  id?: string;
  role?: string;
  content?: ContentItem[];
  name?: string;
  arguments?: string;
  call_id?: string;
  output?: any;
  summary?: any[];
  encrypted_content?: string;
}

export interface ContentItem {
  type?: string;
  text?: string;
}