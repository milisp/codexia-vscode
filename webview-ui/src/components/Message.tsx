import React, { useState } from 'react';
import { ChatMessage } from '../utils/vscode-api';
import DOMPurify from 'dompurify';

interface MessageProps {
  message: ChatMessage;
  index: number;
  onApproveExecution: (execRequestId: string, approved: boolean) => void;
}

const Message: React.FC<MessageProps> = ({ message, index, onApproveExecution }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const getTypeLabel = () => {
    switch (message.type) {
      case "user":
        return "You";
      case "assistant":
        return "Codexia";
      case "exec-request":
        return "Execution Request";
      case "system":
        return "System";
      default:
        return "Unknown";
    }
  };

  const formatContent = (content: string) => {
    // Basic markdown-like formatting
    let formatted = content
      .replace(/\n/g, "<br>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/```([^```]+)```/g, "<pre><code>$1</code></pre>");

    return DOMPurify.sanitize(formatted);
  };

  const isCollapsible = message.type === "exec-request" || message.type === "system";
  const timestamp = new Date(message.timestamp).toLocaleTimeString();

  const baseClasses = "mb-4 p-3 rounded-lg relative";
  const getUserTypeStyle = () => ({
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    marginLeft: '20%'
  });
  const getAssistantTypeStyle = () => ({
    backgroundColor: 'var(--vscode-editor-background)',
    color: 'var(--vscode-editor-foreground)',
    border: '1px solid var(--vscode-input-border)'
  });
  const timelineClasses = message.type !== "user" && index > 0 ? "timeline-item" : "";

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div 
      className={`${baseClasses} ${timelineClasses}`}
      style={message.type === "user" ? getUserTypeStyle() : getAssistantTypeStyle()}
    >
      <div className="flex justify-between items-center mb-2">
        {isCollapsible ? (
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={toggleCollapse}>
            <span className="text-xs transition-transform">
              {isCollapsed ? "▶" : "▼"}
            </span>
            <span className="font-semibold text-sm">{getTypeLabel()}</span>
          </div>
        ) : (
          <span className="font-semibold text-sm">{getTypeLabel()}</span>
        )}
        <span className="text-xs opacity-70">{timestamp}</span>
      </div>
      
      <div 
        className={`text-sm leading-relaxed ${isCollapsible ? `collapsible-content ${isCollapsed ? 'collapsed' : ''}` : ''}`}
        dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
      />

      {message.execRequestId && (
        <div className="flex gap-2 mt-3">
          <button 
            className="px-3 py-1 rounded text-xs hover:opacity-80"
            style={{
              backgroundColor: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)'
            }}
            onClick={() => onApproveExecution(message.execRequestId!, true)}
          >
            ✓ Approve
          </button>
          <button 
            className="px-3 py-1 rounded text-xs hover:opacity-80"
            style={{
              backgroundColor: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)'
            }}
            onClick={() => onApproveExecution(message.execRequestId!, false)}
          >
            ✗ Deny
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(Message);