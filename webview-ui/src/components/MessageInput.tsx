import React, { useState, useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, SendHorizontal } from 'lucide-react';
import ReasoningEffortSelector from './ReasoningEffortSelector';
import ProviderSelector from './ProviderSelector';
import ModelSelector from './ModelSelector';
import { postMessage, setupMessageListener } from '../utils/vscode-api';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  isTyping: boolean;
  onFocus?: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, isTyping, onFocus }) => {
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
      if (message.type === 'configData') {
        if (message.config) {
          setProvider(message.config.provider || 'openai');
          setModel(message.config.model || 'gpt-5');
          setReasoningEffort(message.config.reasoning || 'high');
          setConfigLoaded(true);
        }
      }
    });

    return cleanup;
  }, []);

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
          minRows={3}
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