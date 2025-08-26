import React, { useState, useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, SendHorizontal } from 'lucide-react'

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  isTyping: boolean;
  onFocus?: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, isTyping, onFocus }) => {
  const [inputText, setInputText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (onFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [onFocus]);

  const handleSubmit = () => {
    const text = inputText.trim();
    if (!text || isTyping) {
      return;
    }

    onSendMessage(text);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t pt-3" style={{ borderTopColor: 'var(--vscode-input-border)' }}>
      <div className="flex items-end gap-2 rounded-lg p-2" style={{ 
        backgroundColor: 'var(--vscode-input-background)', 
        border: '1px solid var(--vscode-input-border)' 
      }}>
        <TextareaAutosize
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Codex to do anything..."
          className="flex-1 bg-transparent border-none resize-none outline-none"
          style={{
            color: 'var(--vscode-input-foreground)',
            fontSize: 'var(--vscode-font-size)',
            fontFamily: 'var(--vscode-font-family)'
          }}
          minRows={2}
          maxRows={10}
          disabled={isTyping}
        />
        <button
          onClick={handleSubmit}
          disabled={!inputText.trim() || isTyping}
          className="p-2 rounded flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: inputText.trim() && !isTyping ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
            color: inputText.trim() && !isTyping ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)'
          }}
        >
          <Send className='w-4 h-4' />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;