import * as path from 'path';

export interface FileChange {
  filePath: string;
  changeType: 'add' | 'delete' | 'modify' | 'rename';
  oldPath?: string; // For renames
  hunks: DiffHunk[];
  isAdded: boolean;
  isDeleted: boolean;
  isModified: boolean;
  isRenamed: boolean;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'context' | 'add' | 'delete';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * Parse unified diff output into structured data
 */
export function parseUnifiedDiff(unifiedDiff: string): FileChange[] {
  const files: FileChange[] = [];
  
  if (!unifiedDiff.trim()) {
    return files;
  }

  // Split by file boundaries (lines starting with "diff --git")
  const fileChunks = unifiedDiff.split(/^diff --git /m).filter(chunk => chunk.trim());
  
  for (const chunk of fileChunks) {
    const fileChange = parseFileChange(chunk);
    if (fileChange) {
      files.push(fileChange);
    }
  }
  
  return files;
}

function parseFileChange(chunk: string): FileChange | null {
  const lines = chunk.split('\n');
  
  if (lines.length === 0) {
    return null;
  }

  // First line should be the file paths (already stripped of "diff --git ")
  const firstLine = lines[0];
  const pathMatch = firstLine.match(/^a\/(.+) b\/(.+)$/);
  
  if (!pathMatch) {
    return null;
  }

  const oldPath = pathMatch[1];
  const newPath = pathMatch[2];
  
  let currentLineIndex = 1;
  let changeType: FileChange['changeType'] = 'modify';
  let isAdded = false;
  let isDeleted = false;
  let isModified = false;
  let isRenamed = false;

  // Parse file metadata lines
  while (currentLineIndex < lines.length) {
    const line = lines[currentLineIndex];
    
    if (line.startsWith('new file mode')) {
      changeType = 'add';
      isAdded = true;
    } else if (line.startsWith('deleted file mode')) {
      changeType = 'delete';
      isDeleted = true;
    } else if (line.startsWith('rename from') || line.startsWith('rename to')) {
      changeType = 'rename';
      isRenamed = true;
    } else if (line.startsWith('@@')) {
      // Start of diff hunks
      break;
    } else if (line.startsWith('index') || 
               line.startsWith('old mode') || 
               line.startsWith('new mode') ||
               line.startsWith('---') ||
               line.startsWith('+++')) {
      // Skip metadata lines
    } else if (line.trim() === '') {
      // Skip empty lines
    } else {
      // Unknown format, might be part of hunks
      break;
    }
    
    currentLineIndex++;
  }

  // If not explicitly added or deleted, it's modified
  if (!isAdded && !isDeleted && !isRenamed) {
    isModified = true;
  }

  // Parse hunks
  const hunks = parseHunks(lines.slice(currentLineIndex));

  const filePath = newPath === '/dev/null' ? oldPath : newPath;
  const resultOldPath = isRenamed && oldPath !== newPath ? oldPath : undefined;

  return {
    filePath,
    changeType,
    oldPath: resultOldPath,
    hunks,
    isAdded,
    isDeleted,
    isModified,
    isRenamed,
  };
}

function parseHunks(lines: string[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLineNumber = 0;
  let newLineNumber = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Save previous hunk if exists
      if (currentHunk) {
        hunks.push(currentHunk);
      }

      // Parse hunk header: @@ -oldStart,oldLines +newStart,newLines @@
      const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (hunkMatch) {
        const oldStart = parseInt(hunkMatch[1]);
        const oldLines = hunkMatch[2] ? parseInt(hunkMatch[2]) : 1;
        const newStart = parseInt(hunkMatch[3]);
        const newLines = hunkMatch[4] ? parseInt(hunkMatch[4]) : 1;

        currentHunk = {
          oldStart,
          oldLines,
          newStart,
          newLines,
          header: line,
          lines: [],
        };

        oldLineNumber = oldStart;
        newLineNumber = newStart;
      }
    } else if (currentHunk) {
      // Parse diff line
      if (line.startsWith(' ')) {
        // Context line
        currentHunk.lines.push({
          type: 'context',
          content: line.substring(1),
          oldLineNumber: oldLineNumber,
          newLineNumber: newLineNumber,
        });
        oldLineNumber++;
        newLineNumber++;
      } else if (line.startsWith('+')) {
        // Added line
        currentHunk.lines.push({
          type: 'add',
          content: line.substring(1),
          newLineNumber: newLineNumber,
        });
        newLineNumber++;
      } else if (line.startsWith('-')) {
        // Deleted line
        currentHunk.lines.push({
          type: 'delete',
          content: line.substring(1),
          oldLineNumber: oldLineNumber,
        });
        oldLineNumber++;
      } else if (line === '\\ No newline at end of file') {
        // Ignore this line
      }
    }
  }

  // Save the last hunk
  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

/**
 * Create a summary of changes for display
 */
export function createChangeSummary(fileChanges: FileChange[]): string {
  const summary: string[] = [];
  
  const added = fileChanges.filter(f => f.isAdded).length;
  const deleted = fileChanges.filter(f => f.isDeleted).length;
  const modified = fileChanges.filter(f => f.isModified).length;
  const renamed = fileChanges.filter(f => f.isRenamed).length;

  if (added > 0) {
    summary.push(`${added} file${added > 1 ? 's' : ''} added`);
  }
  if (modified > 0) {
    summary.push(`${modified} file${modified > 1 ? 's' : ''} modified`);
  }
  if (deleted > 0) {
    summary.push(`${deleted} file${deleted > 1 ? 's' : ''} deleted`);
  }
  if (renamed > 0) {
    summary.push(`${renamed} file${renamed > 1 ? 's' : ''} renamed`);
  }

  return summary.join(', ');
}

/**
 * Get workspace relative path
 */
export function getWorkspaceRelativePath(absolutePath: string, workspaceRoot: string): string {
  if (absolutePath.startsWith(workspaceRoot)) {
    return path.relative(workspaceRoot, absolutePath);
  }
  return absolutePath;
}