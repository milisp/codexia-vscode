import React from 'react';

interface ReasoningEffortSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const ReasoningEffortSelector: React.FC<ReasoningEffortSelectorProps> = ({ 
  value, 
  onChange, 
  className = '' 
}) => {
  const options = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' }
  ];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs px-1 py-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded focus:border-[var(--vscode-focusBorder)] outline-none"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ReasoningEffortSelector;