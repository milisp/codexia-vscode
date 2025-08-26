import React from 'react';

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-center gap-2 p-3 italic text-gray-600 dark:text-gray-400">
      <span>Thinking</span>
      <div className="flex gap-1">
        <div className="w-1 h-1 bg-gray-600 dark:bg-gray-400 rounded-full typing-dot"></div>
        <div className="w-1 h-1 bg-gray-600 dark:bg-gray-400 rounded-full typing-dot"></div>
        <div className="w-1 h-1 bg-gray-600 dark:bg-gray-400 rounded-full typing-dot"></div>
      </div>
    </div>
  );
};

export default TypingIndicator;