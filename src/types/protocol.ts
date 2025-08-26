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
  command?: string;
  call_id?: string;
  stream?: string;
  chunk?: number[];
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  unified_diff?: string;
  [key: string]: any;
}