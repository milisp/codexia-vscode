import React, { useState, useEffect } from 'react';
import { ChatMessage, postMessage, setupMessageListener } from '../utils/vscode-api';
import Message from './Message';

interface ConversationHistory {
  conversation_id: string;
  entries: any[];
}

interface HistoryViewProps {
  onDone: () => void;
}

interface ChatSession {
  id: string;
  name: string;
  timestamp: number;
  messages: ChatMessage[];
  entries?: any[];
  messageCount?: number;
}

const HistoryView: React.FC<HistoryViewProps> = ({ onDone }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    console.log('[HistoryView] Component mounted, requesting session history');
    // Request session history from ~/.codex/sessions
    postMessage({ type: 'getSessionHistory' });
    
    // Also try to get current conversation history
    postMessage({ type: 'getConversationHistory' });
    
    const cleanup = setupMessageListener((message) => {
      console.log('[HistoryView] Received message:', message.type, message);
      
      if (message.type === 'conversationHistoryData') {
        console.log('[HistoryView] Setting conversation history data');
        setConversationHistory(message.data || null);
        setLoading(false);
      } else if (message.type === 'showSessionHistory') {
        console.log('[HistoryView] Processing showSessionHistory with', message.sessions?.length, 'sessions');
        // Handle session history from ~/.codex/sessions
        const sessionData = message.sessions || [];
        const formattedSessions: ChatSession[] = sessionData.map((session: any) => ({
          id: session.id,
          name: session.name,
          timestamp: session.timestamp,
          messages: [], // We'll store entries separately
          entries: session.entries || [],
          messageCount: session.messageCount || 0
        }));
        console.log('[HistoryView] Setting sessions:', formattedSessions.length, 'sessions');
        setSessions(formattedSessions);
        setLoading(false);
      } else if (message.type === 'chatHistory') {
        console.log('[HistoryView] Processing chatHistory');
        // Fallback to local sessions if available
        const regularSessions: ChatSession[] = (message.sessions || []).map((session: any) => ({
          ...session,
          entries: session.entries || [],
          messageCount: session.messageCount || session.messages?.length || 0
        }));
        setSessions(regularSessions);
        if (!conversationHistory) {
          setLoading(false);
        }
      }
    });

    return cleanup;
  }, [conversationHistory]);

  const handleSessionSelect = (session: ChatSession) => {
    setSelectedSession(session);
  };

  const handleLoadSession = (session: ChatSession) => {
    if (session.entries && session.entries.length > 0) {
      // Load session from ~/.codex/sessions history
      postMessage({ 
        type: 'loadSessionFromHistory', 
        sessionId: session.id,
        sessionEntries: session.entries,
        sessionName: session.name
      });
    } else {
      // Load regular chat session (fallback)
      postMessage({ 
        type: 'loadChatSession', 
        sessionId: session.id 
      });
    }
    onDone();
  };

  const handleResumeFromPoint = (messageIndex: number) => {
    if (!conversationHistory) return;
    
    setLoadingHistory(true);
    // Resume conversation by dropping messages after the selected point
    const messagesToDrop = conversationHistory.entries.length - messageIndex - 1;
    postMessage({
      type: 'resumeConversation',
      conversationId: conversationHistory.conversation_id,
      dropLastMessages: messagesToDrop
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
      <div className="flex flex-col h-screen p-4">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          <button 
            onClick={onDone} 
            className="flex items-center gap-2 px-3 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ← Back to Chat
          </button>
          <h2 className="text-lg font-semibold">Conversation History</h2>
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading history...</p>
          </div>
        </div>
      </div>
    );
  }

  const renderConversationEntry = (entry: any, index: number) => {
    // Handle new JSONL format
    if (entry.type === 'message' && entry.role && entry.content) {
      const isUser = entry.role === 'user';
      const textContent = entry.content.filter((item: any) => 
        item.type === 'input_text' || item.type === 'output_text'
      );

      if (textContent.length === 0) return null;

      return (
        <div key={index} className={`mb-4 p-3 rounded-lg border ${
          isUser 
            ? 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
        }`}>
          <div className="flex justify-between items-center mb-2">
            <span className={`font-semibold ${
              isUser 
                ? 'text-blue-700 dark:text-blue-300' 
                : 'text-gray-700 dark:text-gray-300'
            }`}>
              {isUser ? 'User' : 'Assistant'}
            </span>
            <button 
              className={`px-2 py-1 text-xs rounded text-white hover:opacity-80 transition-colors ${
                isUser ? 'bg-blue-500' : 'bg-gray-500'
              }`}
              onClick={() => handleResumeFromPoint(index)}
              title="Resume conversation from this point"
            >
              Resume from here
            </button>
          </div>
          <div className="text-sm space-y-1">
            {textContent.map((content: any, i: number) => 
              <p key={i} className="whitespace-pre-wrap">{content.text}</p>
            )}
          </div>
        </div>
      );
    }

    // Handle function calls for context
    if (entry.type === 'function_call' && entry.name) {
      return (
        <div key={index} className="mb-4 p-3 rounded-lg border border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-yellow-700 dark:text-yellow-300">
              Function Call: {entry.name}
            </span>
          </div>
          <div className="text-sm">
            <pre className="whitespace-pre-wrap text-xs bg-black/10 dark:bg-white/10 p-2 rounded">
              {JSON.stringify(JSON.parse(entry.arguments || '{}'), null, 2)}
            </pre>
          </div>
        </div>
      );
    }

    // Handle function outputs
    if (entry.type === 'function_call_output' && entry.call_id) {
      return (
        <div key={index} className="mb-4 p-3 rounded-lg border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-green-700 dark:text-green-300">
              Function Output
            </span>
          </div>
          <div className="text-sm">
            <pre className="whitespace-pre-wrap text-xs bg-black/10 dark:bg-white/10 p-2 rounded">
              {entry.output || 'No output'}
            </pre>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-screen p-4">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        <button 
          onClick={onDone} 
          className="flex items-center gap-2 px-3 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          ← Back to Chat
        </button>
        <h2 className="text-lg font-semibold">Conversation History</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {conversationHistory ? (
          <div>
            <div className="mb-4">
              <h3 className="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">
                Current Conversation ({conversationHistory.entries.length} entries)
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Click "Resume from here" on any message to continue the conversation from that point.
              </p>
            </div>
            <div className="space-y-3">
              {conversationHistory.entries.map((entry, index) => 
                renderConversationEntry(entry, index)
              )}
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">
              Sessions ({sessions.length})
            </h3>
            {sessions.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No chat sessions found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSession?.id === session.id 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    onClick={() => handleSessionSelect(session)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{session.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {formatDate(session.timestamp)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {session.messageCount || session.messages.length} entries
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadSession(session);
                          }}
                          className="px-2 py-1 text-xs rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
                        >
                          Load
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                          }}
                          className="px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {selectedSession && (
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">
              Preview: {selectedSession.name}
            </h3>
            <div className="space-y-3">
              {selectedSession.entries ? (
                // Show session entries from ~/.codex/sessions
                selectedSession.entries.slice(0, 5).map((entry, index) => 
                  renderConversationEntry(entry, index)
                )
              ) : (
                // Show regular chat messages
                selectedSession.messages.slice(0, 5).map((message, index) => (
                  <Message
                    key={message.id}
                    message={message}
                    index={index}
                    onApproveExecution={() => {}}
                  />
                ))
              )}
              {(selectedSession.entries ? selectedSession.entries.length : selectedSession.messages.length) > 5 && (
                <div className="p-3 text-sm text-center text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded">
                  And {(selectedSession.entries ? selectedSession.entries.length : selectedSession.messages.length) - 5} more entries...
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