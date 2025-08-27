import React, { useState, useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, SendHorizontal } from 'lucide-react';
import ReasoningEffortSelector from './ReasoningEffortSelector';
import ProviderSelector from './ProviderSelector';
import ModelSelector from './ModelSelector';
import ContextBadge from './ContextBadge';
import { postMessage, setupMessageListener } from '../utils/vscode-api';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  isTyping: boolean;
  onFocus?: () => void;
  contextFiles: ContextFile[];
  onRemoveContextFile: (path: string) => void;
}

interface ContextFile {
  path: string;
  relativePath: string;
  name: string;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, isTyping, onFocus, contextFiles, onRemoveContextFile }) => {
  const [inputText, setInputText] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState('high');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-5');
  const [configLoaded, setConfigLoaded] = useState(false);
  
  // Mock data for demo - in real app this would come from props or context
  const providers = ['openai', 'anthropic', 'google', 'ollama', 'openrouter'];
  const modelOptions: { [key: string]: string[] } = {
    openai: ['gpt-5', 'gpt-5-mini', 'gpt-4o', 'gpt-4o-mini'],
    openrouter: ['openai/gpt-oss-20b:free', 'qwen/qwen3-coder:free', 'moonshotai/kimi-k2:free'],
    ollama: ['llama3.2', 'gpt-oss:20b', 'mistral'],
    anthropic: ['claude-4-sonnet'],
    google: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (onFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [onFocus]);

  useEffect(() => {
    // Request config on component mount
    postMessage({ type: 'getConfig' });
    
    const cleanup = setupMessageListener((message) => {
      // Only handle config messages for MessageInput
      if (message.type === 'configData' && message.config) {
        setProvider(message.config.provider || 'openai');
        setModel(message.config.model || 'gpt-5');
        setReasoningEffort(message.config.reasoning || 'high');
        setConfigLoaded(true);
      }
    });

    return cleanup;
  }, []);

  const handleSubmit = () => {
    const text = inputText.trim();
    if (!text || isTyping) {
      return;
    }

    // Add context files relative paths to message if any files are selected
    let messageWithContext = text;
    if (contextFiles.length > 0) {
      const relativePaths = contextFiles.map(f => f.relativePath).join(' ');
      messageWithContext = `${text}\n\nFiles: ${relativePaths}`;
    }
    
    onSendMessage(messageWithContext);
    setInputText('');
  };

  const removeContextFile = (pathToRemove: string) => {
    onRemoveContextFile(pathToRemove);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Allow Shift+Enter for line breaks (default textarea behavior)
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const availableModels = modelOptions[newProvider] || [];
    const newModel = availableModels.length > 0 ? availableModels[0] : '';
    setModel(newModel);
    
    // Disable OSS mode when selecting non-ollama providers
    const useOss = newProvider === 'ollama';
    
    postMessage({
      type: 'updateConfig',
      config: { 
        provider: newProvider, 
        model: newModel,
        useOss: useOss
      }
    });
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    postMessage({
      type: 'updateConfig',
      config: { model: newModel }
    });
  };

  const handleReasoningChange = (newReasoning: string) => {
    setReasoningEffort(newReasoning);
    postMessage({
      type: 'updateConfig',
      config: { reasoning: newReasoning }
    });
  };

  return (
    <div className="border-t pt-3 vscode-border-top">
      <div className="flex items-end gap-2 rounded-lg p-2 vscode-input-container">
        <div className="flex-1 relative">
          {contextFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {contextFiles.map((file) => (
                <ContextBadge
                  key={file.path}
                  fileName={file.name}
                  relativePath={file.relativePath}
                  onRemove={() => removeContextFile(file.path)}
                />
              ))}
            </div>
          )}
          <TextareaAutosize
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Codex to do anything..."
            className="w-full bg-transparent border-none resize-none outline-none vscode-textarea"
            minRows={3}
            maxRows={10}
            disabled={isTyping}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!inputText.trim() || isTyping}
          className="p-2 rounded flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed vscode-send-button"
        >
          <Send className='w-4 h-4' />
        </button>
      </div>
      <div className="flex justify-between items-center mt-2 gap-1">
        <ProviderSelector 
          value={provider}
          onChange={handleProviderChange}
          providers={providers}
        />
        <ModelSelector 
          value={model}
          onChange={handleModelChange}
          models={modelOptions[provider] || []}
        />
        <ReasoningEffortSelector 
          value={reasoningEffort}
          onChange={handleReasoningChange}
        />
      </div>
    </div>
  );
};

export default MessageInput;