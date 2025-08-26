import React from 'react';

interface ProviderSelectorProps {
  value: string;
  onChange: (value: string) => void;
  providers: string[];
  className?: string;
}

const ProviderSelector: React.FC<ProviderSelectorProps> = ({ 
  value, 
  onChange, 
  providers,
  className = '' 
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs px-1 py-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded focus:border-[var(--vscode-focusBorder)] outline-none"
      >
        {providers.map(provider => (
          <option key={provider} value={provider}>
            {provider}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ProviderSelector;