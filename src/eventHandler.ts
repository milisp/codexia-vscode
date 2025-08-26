import type { Event } from "./types/protocol";
import { CodexService } from "./codexService";

export function handleCodexEvent(service: CodexService, line: string): void {
  try {
    const event: Event = JSON.parse(line);
    if (event.msg.type !== 'agent_message_delta') {
      console.log("Received event:", event.msg.type);
    } 

    if (event.msg.type === "session_configured") {
      (service as any)._sessionId = event.msg.session_id;
      (service as any)._isReady = true;
      console.log(`Session configured with ID: ${event.msg.session_id}`);
      service.emit("session-ready", event.msg.session_id);
      return;
    }

    if (event.msg.type === "agent_message") {
      service.emit(
        "agent-message",
        event.msg.message || event.msg.last_agent_message || "",
      );
      return;
    }

    if (event.msg.type === "agent_message_delta") {
      service.emit("agent-message-delta", event.msg.delta || "");
      return;
    }

    if (event.msg.type === "exec_request") {
      console.log("Execution request:", {
        id: event.msg.id,
        command: event.msg.command,
      });
      service.emit("exec-request", {
        id: event.msg.id,
        command: event.msg.command,
      });
      return;
    }

    if (event.msg.type === "exec_command_begin") {
      console.log("exec_command_begin:", event);
      return;
    }

    if (event.msg.type === "exec_command_output_delta") {
      const chunk = event.msg.chunk
        ? String.fromCharCode(...event.msg.chunk)
        : "";
      service.emit("exec-output", {
        call_id: event.msg.call_id,
        stream: event.msg.stream,
        chunk: chunk,
      });
      return;
    }

    if (event.msg.type === "exec_command_end") {
      service.emit("exec-complete", {
        call_id: event.msg.call_id,
        stdout: event.msg.stdout,
        stderr: event.msg.stderr,
        exit_code: event.msg.exit_code,
      });
      return;
    }

    if (event.msg.type === "task_complete") {
      console.log("Task completed:", event.msg.last_agent_message?.substring(1, 20));
      service.emit("task-complete", {
        last_message: event.msg.last_agent_message,
      });
      return;
    }

    if (event.msg.type === "turn_diff") {
      console.log("Turn diff received, length:", event.msg.unified_diff?.length || 0);
      service.emit("turn-diff", event.msg.unified_diff || "");
      return;
    }

    service.emit("codex-event", event);
  } catch (error) {
    console.error("Failed to parse codex event:", line, error);
  }
}
