import type { Event } from "./types/protocol";
import { CodexService } from "./codexService";

// Track apply_patch commands to emit proper events
let activePatchCommands = new Set<string>();

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

    if (event.msg.type === "exec_approval_request") {
      console.log("exec_approval_request received:", {
        event_id: event.id,
        call_id: event.msg.call_id,
        command: event.msg.command,
        cwd: event.msg.cwd,
        reason: event.msg.reason
      });
      service.emit("exec-approval-request", {
        event_id: event.id,
        call_id: event.msg.call_id,
        command: event.msg.command,
        cwd: event.msg.cwd,
        reason: event.msg.reason,
      });
      return;
    }

    if (event.msg.type === "apply_patch_approval_request") {
      console.log("apply_patch_approval_request received:", {
        event_id: event.id, // This is the important part!
        call_id: event.msg.call_id,
        changes: event.msg.changes,
        reason: event.msg.reason,
        grant_root: event.msg.grant_root
      });
      service.emit("patch-approval-request", {
        event_id: event.id, // Pass the event ID
        call_id: event.msg.call_id,
        changes: event.msg.changes,
        reason: event.msg.reason,
        grant_root: event.msg.grant_root,
      });
      return;
    }

    if (event.msg.type === "patch_apply_begin") {
      console.log("patch_apply_begin:", event);
      service.emit("patch-apply-begin", {
        call_id: event.msg.call_id,
        auto_approved: event.msg.auto_approved,
        changes: event.msg.changes,
      });
      return;
    }

    if (event.msg.type === "patch_apply_end") {
      console.log("patch_apply_end:", event);
      service.emit("patch-apply-end", {
        call_id: event.msg.call_id,
        stdout: event.msg.stdout,
        stderr: event.msg.stderr,
        success: event.msg.success,
      });
      return;
    }

    if (event.msg.type === "exec_command_begin") {
      console.log("exec_command_begin:", event);
      console.log("exec_command_begin call_id:", event.msg.call_id);
      
      // Emit general exec-begin event
      service.emit("exec-begin", {
        call_id: event.msg.call_id,
        command: event.msg.command,
        cwd: event.msg.cwd,
      });
      
      // Check if this is an apply_patch command
      if (event.msg.command && Array.isArray(event.msg.command) && event.msg.command[0] === "apply_patch") {
        const callId = event.msg.call_id || "apply_patch";
        console.log("Detected apply_patch command with call_id:", callId);
        activePatchCommands.add(callId);
        service.emit("patch-apply-begin", {
          call_id: callId,
          auto_approved: true, // If it's executing, it was already approved
          changes: {}, // We don't have detailed changes info here
        });
      }
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
      const callId = event.msg.call_id || "apply_patch";
      console.log("exec_command_end call_id:", callId);
      
      // Check if this was an apply_patch command
      if (activePatchCommands.has(callId)) {
        console.log("Detected apply_patch completion with call_id:", callId);
        activePatchCommands.delete(callId);
        service.emit("patch-apply-end", {
          call_id: callId,
          stdout: event.msg.stdout || "",
          stderr: event.msg.stderr || "",
          success: event.msg.exit_code === 0,
        });
      }
      
      service.emit("exec-complete", {
        call_id: event.msg.call_id,
        stdout: event.msg.stdout,
        stderr: event.msg.stderr,
        exit_code: event.msg.exit_code,
      });
      return;
    }

    if (event.msg.type === "task_complete") {
      console.log("Task completed:", event.msg.last_agent_message?.substring(0, 20));
      service.emit("task-complete", {
        last_message: event.msg.last_agent_message,
      });
      return;
    }

    if (event.msg.type === "background_event") {
      console.log("Background event:", event.msg.message);
      service.emit("background-event", {
        message: event.msg.message,
      });
      return;
    }

    if (event.msg.type === "shutdown_complete") {
      console.log("Codex shutdown complete");
      service.emit("shutdown-complete");
      return;
    }

    if (event.msg.type === "turn_diff") {
      console.log("Turn diff received, length:", event.msg.unified_diff?.length || 0);
      service.emit("turn-diff", event.msg.unified_diff || "");
      return;
    }

    if (event.msg.type === "error" || event.msg.type === "stream_error") {
      console.log("Error event received:", event.msg.type, event.msg);
      service.emit("error-event", {
        type: event.msg.type,
        message: event.msg.message || event.msg.error || "An error occurred",
        details: event.msg
      });
      return;
    }

    // Log unhandled events for debugging
    console.log("Unhandled event:", event.msg.type, event);
    service.emit("codex-event", event);
  } catch (error) {
    console.error("Failed to parse codex event:", line, error);
  }
}
