import React from 'react';

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  models: string[];
  className?: string;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ 
  value, 
  onChange, 
  models,
  className = '' 
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs px-1 py-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded focus:border-[var(--vscode-focusBorder)] outline-none"
      >
        {models.map(model => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ModelSelector;