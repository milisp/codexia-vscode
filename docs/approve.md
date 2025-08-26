# Codex Approval System Implementation Guide

This document explains how to implement the approval functionality for Codex CLI in VS Code extensions using React webview architecture.

## Overview

The Codex approval system allows users to review and approve commands or code changes before execution. There are two main types of approvals:

1. **Execution Approval** (`exec_approval_request`) - For shell commands
2. **Patch Approval** (`apply_patch_approval_request`) - For file modifications

## Architecture Flow

```
Codex CLI → WebSocket → CodexService → ChatProvider → React Webview → User → Approval Decision → CodexService → Codex CLI
```

## Key Components

### 1. Event Handler (`eventHandler.ts`)

Handles incoming events from Codex CLI and parses approval requests:

```typescript
if (event.msg.type === "exec_approval_request") {
  service.emit("exec-approval-request", {
    call_id: event.msg.call_id,
    command: event.msg.command,
    cwd: event.msg.cwd,
    reason: event.msg.reason,
  });
}

if (event.msg.type === "apply_patch_approval_request") {
  service.emit("patch-approval-request", {
    event_id: event.id, // CRITICAL: Use event.id, not msg.call_id!
    call_id: event.msg.call_id,
    changes: event.msg.changes,
    reason: event.msg.reason,
    grant_root: event.msg.grant_root,
  });
}
```

### 2. Codex Service (`codexService.ts`)

Manages communication with Codex CLI:

```typescript
public async approveExecution(requestId: string, approved: boolean): Promise<void> {
  const submission: Submission = {
    id: generateId(),
    op: {
      type: "exec_approval",
      id: requestId,
      decision: approved ? "approved" : "denied",
    },
  };
  this._sendSubmission(submission);
}

public async approvePatch(requestId: string, approved: boolean): Promise<void> {
  const submission: Submission = {
    id: generateId(),
    op: {
      type: "patch_approval",
      id: requestId, // This must be the event.id!
      decision: approved ? "approved" : "denied",
    },
  };
  this._sendSubmission(submission);
}
```

### 3. Chat Provider (`chatProvider.ts`)

Handles approval requests and creates approval messages:

```typescript
private _onExecApprovalRequest(request: { call_id: string; command: string | string[]; cwd: string; reason?: string }): void {
  const command = Array.isArray(request.command) ? request.command.join(' ') : request.command;
  const content = `Execute command: ${command}${request.reason ? `\n\nReason: ${request.reason}` : ''}`;
  
  const approvalMessage: ChatMessage = {
    id: this._generateId(),
    type: "exec-request",
    content,
    timestamp: new Date(),
    execRequestId: request.call_id, // Use call_id for exec approvals
  };
  this._messages.push(approvalMessage);
  this._updateWebview();
}

private _onPatchApprovalRequest(request: { event_id: string; call_id: string; changes: any; reason?: string; grant_root?: string }): void {
  // ... create content from changes ...
  
  const approvalMessage: ChatMessage = {
    id: messageId,
    type: "exec-request",
    content,
    timestamp: new Date(),
    execRequestId: messageId, // Use generated ID for UI tracking
  };
  
  // CRITICAL: Store the original event_id for approval!
  (approvalMessage as any).originalEventId = request.event_id;
  (approvalMessage as any).originalCallId = request.call_id;
}
```

### 4. Approval Handling

```typescript
private async _handleExecutionApproval(requestId: string, approved: boolean): Promise<void> {
  const originalMessage = this._messages.find(msg => 
    msg.execRequestId === requestId && msg.type === "exec-request"
  );
  
  if (originalMessage && originalMessage.content.includes("Apply changes")) {
    // Patch approval - use the original event_id (NOT call_id!)
    const originalEventId = (originalMessage as any).originalEventId || requestId;
    await this._codexService.approvePatch(originalEventId, approved);
  } else {
    // Exec approval - use call_id
    await this._codexService.approveExecution(requestId, approved);
  }
}
```

### 5. React Component (`Message.tsx`)

Displays approval buttons:

```typescript
{(message.execRequestId || message.type === "exec-request") && (
  <div className="flex gap-2 mt-3">
    <button onClick={() => onApproveExecution(message.execRequestId || message.id, true)}>
      ✓ Approve
    </button>
    <button onClick={() => onApproveExecution(message.execRequestId || message.id, false)}>
      ✗ Deny
    </button>
  </div>
)}
```

## Critical Implementation Details

### 1. ID Management

**The most critical aspect is using the correct IDs:**

- **Exec Approval**: Use `call_id` from the request
- **Patch Approval**: Use `event.id` from the event (NOT `msg.call_id`)

This is because:
- `exec_approval_request` expects the `call_id` for identification
- `apply_patch_approval_request` expects the `event.id` for proper correlation

### 2. Event Types

Handle these events in `eventHandler.ts`:
- `exec_approval_request` → execution approval
- `apply_patch_approval_request` → code change approval
- `patch_apply_begin` → patch application started
- `patch_apply_end` → patch application completed
- `background_event` → errors and status messages

### 3. Approval Policy Configuration

Set in Codex CLI args:
```typescript
args.push("-c", `approval_policy=${this._config.approvalPolicy}`);
```

Options:
- `never` - Auto-approve everything
- `on-request` - Model decides when to ask
- `on-failure` - Auto-approve, ask on failure
- `unless-trusted` - Ask unless command is known safe

### 4. Message UI Structure

```typescript
interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "exec-request" | "system";
  content: string;
  timestamp: Date;
  execRequestId?: string; // Shows approval buttons when present
}
```

## Common Pitfalls

### 1. ❌ Wrong ID Usage
```typescript
// WRONG - using call_id for patch approval
await this._codexService.approvePatch(request.call_id, approved);

// CORRECT - using event_id for patch approval
await this._codexService.approvePatch(request.event_id, approved);
```

### 2. ❌ Missing Event ID
```typescript
// WRONG - not passing event.id
service.emit("patch-approval-request", {
  call_id: event.msg.call_id, // This is often empty!
  changes: event.msg.changes,
});

// CORRECT - passing event.id
service.emit("patch-approval-request", {
  event_id: event.id, // This is the key identifier
  call_id: event.msg.call_id,
  changes: event.msg.changes,
});
```

### 3. ❌ Session Management Issues
- Ensure proper session lifecycle management
- Handle `shutdown_complete` events
- Add auto-restart for crashed sessions

## Testing

1. Set `approval_policy=unless-trusted`
2. Request file creation/modification
3. Verify approval buttons appear
4. Click approve and verify execution continues
5. Check logs for correct ID usage

## Debugging

Enable detailed logging:
```typescript
console.log("exec_approval_request received:", {
  call_id: event.msg.call_id,
  command: event.msg.command,
});

console.log("apply_patch_approval_request received:", {
  event_id: event.id, // Key for debugging
  call_id: event.msg.call_id,
  changes: event.msg.changes,
});
```

## Complete Flow Example

1. User requests file creation with `approval_policy=unless-trusted`
2. Codex sends `apply_patch_approval_request` event with `event.id`
3. Extension shows approval UI with buttons
4. User clicks "Approve"
5. Extension sends `patch_approval` operation with correct `event.id`
6. Codex continues with `patch_apply_begin` → `patch_apply_end`
7. File is created successfully

This implementation ensures proper approval workflow integration with Codex CLI across different VS Code extension architectures.