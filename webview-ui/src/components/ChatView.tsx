import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, WorkingTask, MessageFromExtension, setupMessageListener, postMessage } from '../utils/vscode-api';
import Message from './Message';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import WorkingTasks from './WorkingTasks';
import { useAppContext } from '../context/AppContext';

interface ChatViewProps {
  isHidden: boolean;
  showAnnouncement: boolean;
  hideAnnouncement: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({ 
  isHidden, 
  showAnnouncement, 
  hideAnnouncement 
}) => {
  const { showSettingsView, hideSettings } = useAppContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [workingTasks, setWorkingTasks] = useState<WorkingTask[]>([]);
  const [shouldFocusInput, setShouldFocusInput] = useState(false);
  const [contextFiles, setContextFiles] = useState<Array<{
    path: string;
    relativePath: string;
    name: string;
  }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    // Request context files on component mount
    postMessage({ type: 'getContextFiles' });
    
    const cleanup = setupMessageListener((message: MessageFromExtension) => {
      switch (message.type) {
        case 'updateMessages':
          if (message.messages) {
            setMessages(message.messages);
          }
          break;
        case 'setTyping':
          setIsTyping(message.isTyping || false);
          break;
        case 'focusInput':
          setShouldFocusInput(true);
          setTimeout(() => setShouldFocusInput(false), 100);
          break;
        case 'updateWorkingTasks':
          setWorkingTasks(message.tasks || []);
          break;
        case 'showSettings':
          showSettingsView();
          break;
        case 'hideSettings':
          hideSettings();
          break;
        case 'contextFilesData':
          setContextFiles(message.files || []);
          break;
      }
    });

    return cleanup;
  }, []);

  const handleSendMessage = (text: string) => {
    postMessage({
      type: 'sendMessage',
      text,
    });
  };

  const handleApproveExecution = (execRequestId: string, approved: boolean) => {
    postMessage({
      type: 'approveExecution',
      execRequestId,
      approved,
    });
  };

  const handleRemoveContextFile = (pathToRemove: string) => {
    setContextFiles(prev => prev.filter(file => file.path !== pathToRemove));
    postMessage({ type: 'removeContextFile', path: pathToRemove });
  };


  if (isHidden) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen">
      {showAnnouncement && (
        <div className="mb-3 p-3 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded">
          <div className="flex items-center justify-between text-sm text-blue-800 dark:text-blue-200">
            <span>🎉 Welcome to Codexia! New features and improvements are available.</span>
            <button 
              onClick={hideAnnouncement} 
              className="text-blue-800 dark:text-blue-200 hover:opacity-70 px-2 py-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      <WorkingTasks tasks={workingTasks} />
      
      <div className="flex-1 overflow-y-auto py-2 mb-4">
        {messages.map((message, index) => (
          <Message
            key={message.id}
            message={message}
            index={index}
            onApproveExecution={handleApproveExecution}
          />
        ))}
        
        {isTyping && <TypingIndicator />}
        
        <div ref={messagesEndRef} />
      </div>

      <MessageInput
        onSendMessage={handleSendMessage}
        isTyping={isTyping}
        onFocus={shouldFocusInput ? () => {} : undefined}
        contextFiles={contextFiles}
        onRemoveContextFile={handleRemoveContextFile}
      />
    </div>
  );
};

export default ChatView;