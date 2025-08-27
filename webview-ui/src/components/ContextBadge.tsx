import React from 'react';
import { X } from 'lucide-react';

interface ContextBadgeProps {
  fileName: string;
  relativePath: string;
  onRemove: () => void;
}

const ContextBadge: React.FC<ContextBadgeProps> = ({ fileName, relativePath, onRemove }) => {
  return (
    <div 
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border"
      style={{
        backgroundColor: 'var(--vscode-badge-background)',
        color: 'var(--vscode-badge-foreground)',
        borderColor: 'var(--vscode-input-border)'
      }}
      title={relativePath}
    >
      <span>{fileName}</span>
      <button
        onClick={onRemove}
        className="p-0 hover:opacity-70 transition-opacity"
        style={{ color: 'inherit' }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

export default ContextBadge;