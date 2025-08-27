import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface ProviderModelSelectorProps {
  provider: string;
  model: string;
  providers: string[];
  modelOptions: { [key: string]: string[] };
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  className?: string;
}

const ProviderModelSelector: React.FC<ProviderModelSelectorProps> = ({
  provider,
  model,
  providers,
  modelOptions,
  onProviderChange,
  onModelChange,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleProviderSelect = (newProvider: string) => {
    onProviderChange(newProvider);
    setIsOpen(false);
  };

  const handleModelSelect = (newModel: string) => {
    onModelChange(newModel);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Display button showing current model */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs px-2 py-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded hover:border-[var(--vscode-focusBorder)] outline-none"
      >
        <span>{model}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 bg-[var(--vscode-dropdown-background)] border border-[var(--vscode-dropdown-border)] rounded shadow-lg z-50 min-w-48">
          {/* Provider selection */}
          <div className="p-2 border-b border-[var(--vscode-dropdown-border)]">
            <div className="text-xs text-[var(--vscode-descriptionForeground)] mb-1">Provider</div>
            <div className="grid grid-cols-1 gap-1">
              {providers.map((prov) => (
                <button
                  key={prov}
                  onClick={() => handleProviderSelect(prov)}
                  className={`text-left text-xs px-2 py-1 rounded hover:bg-[var(--vscode-list-hoverBackground)] ${
                    provider === prov ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]' : ''
                  }`}
                >
                  {prov}
                </button>
              ))}
            </div>
          </div>

          {/* Model selection */}
          <div className="p-2">
            <div className="text-xs text-[var(--vscode-descriptionForeground)] mb-1">Model</div>
            <div className="grid grid-cols-1 gap-1">
              {(modelOptions[provider] || []).map((modelOption) => (
                <button
                  key={modelOption}
                  onClick={() => handleModelSelect(modelOption)}
                  className={`text-left text-xs px-2 py-1 rounded hover:bg-[var(--vscode-list-hoverBackground)] ${
                    model === modelOption ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]' : ''
                  }`}
                >
                  {modelOption}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderModelSelector;