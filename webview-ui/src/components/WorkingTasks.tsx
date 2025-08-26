import React from 'react';
import { WorkingTask } from '../utils/vscode-api';

interface WorkingTasksProps {
  tasks: WorkingTask[];
}

const WorkingTasks: React.FC<WorkingTasksProps> = ({ tasks }) => {
  if (!tasks || tasks.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Working on:</h3>
      </div>
      <ul className="space-y-1">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-2 text-sm">
            <span className="flex-shrink-0">
              {task.status === 'running' && '⏳'}
              {task.status === 'completed' && '✅'}
              {task.status === 'failed' && '❌'}
              {task.status === 'pending' && '⏸️'}
            </span>
            <span className="text-gray-700 dark:text-gray-300">{task.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default WorkingTasks;