import React, { useState, useEffect } from 'react';
import { ChatMessage, postMessage, setupMessageListener } from '../utils/vscode-api';
import Message from './Message';

interface HistoryViewProps {
  onDone: () => void;
}

interface ChatSession {
  id: string;
  name: string;
  timestamp: number;
  messages: ChatMessage[];
}

const HistoryView: React.FC<HistoryViewProps> = ({ onDone }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Request chat history from extension
    postMessage({ type: 'getChatHistory' });
    
    const cleanup = setupMessageListener((message) => {
      if (message.type === 'chatHistory') {
        setSessions(message.sessions || []);
        setLoading(false);
      }
    });

    return cleanup;
  }, []);

  const handleSessionSelect = (session: ChatSession) => {
    setSelectedSession(session);
  };

  const handleLoadSession = (session: ChatSession) => {
    // Load the selected session back to chat
    postMessage({ 
      type: 'loadChatSession', 
      sessionId: session.id 
    });
    onDone();
  };

  const handleDeleteSession = (sessionId: string) => {
    postMessage({ 
      type: 'deleteChatSession', 
      sessionId 
    });
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (selectedSession?.id === sessionId) {
      setSelectedSession(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="history-view">
        <div className="history-header">
          <button onClick={onDone} className="back-button">
            ← Back to Chat
          </button>
          <h2>Chat History</h2>
        </div>
        <div className="loading">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="history-view">
      <div className="history-header">
        <button onClick={onDone} className="back-button">
          ← Back to Chat
        </button>
        <h2>Chat History</h2>
      </div>
      
      <div className="history-content">
        <div className="sessions-list">
          <h3>Sessions ({sessions.length})</h3>
          {sessions.length === 0 ? (
            <div className="empty-state">No chat sessions found</div>
          ) : (
            <div className="sessions">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`session-item ${selectedSession?.id === session.id ? 'selected' : ''}`}
                  onClick={() => handleSessionSelect(session)}
                >
                  <div className="session-info">
                    <div className="session-name">{session.name}</div>
                    <div className="session-date">{formatDate(session.timestamp)}</div>
                    <div className="session-stats">
                      {session.messages.length} messages
                    </div>
                  </div>
                  <div className="session-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoadSession(session);
                      }}
                      className="load-button"
                    >
                      Load
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id);
                      }}
                      className="delete-button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {selectedSession && (
          <div className="session-preview">
            <h3>Preview: {selectedSession.name}</h3>
            <div className="messages-preview">
              {selectedSession.messages.slice(0, 5).map((message, index) => (
                <Message
                  key={message.id}
                  message={message}
                  index={index}
                  onApproveExecution={() => {}}
                />
              ))}
              {selectedSession.messages.length > 5 && (
                <div className="more-messages">
                  And {selectedSession.messages.length - 5} more messages...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;