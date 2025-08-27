import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SessionFile {
  sessionId: string;
  filePath: string;
  timestamp: Date;
  size: number;
  name: string;
}

export interface ParsedSession {
  sessionId: string;
  timestamp: Date;
  entries: any[];
  name: string;
  messageCount: number;
}

export class SessionHistoryService {
  private readonly sessionsDir: string;

  constructor() {
    // Default Codex sessions directory
    this.sessionsDir = path.join(os.homedir(), '.codex', 'sessions');
    console.log('[SessionHistoryService] Sessions directory:', this.sessionsDir);
  }

  /**
   * Get all session files from ~/.codex/sessions (organized by year/month/day)
   */
  public async getSessionFiles(): Promise<SessionFile[]> {
    try {
      console.log('[SessionHistoryService] Checking sessions directory:', this.sessionsDir);
      if (!fs.existsSync(this.sessionsDir)) {
        console.log('[SessionHistoryService] Sessions directory not found:', this.sessionsDir);
        return [];
      }

      console.log('[SessionHistoryService] Sessions directory exists, scanning for files...');
      const sessionFiles: SessionFile[] = [];
      await this.scanDirectoryRecursive(this.sessionsDir, sessionFiles);

      console.log(`[SessionHistoryService] Found ${sessionFiles.length} session files`);
      
      // Sort by timestamp (newest first)
      const sortedFiles = sessionFiles.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      console.log('[SessionHistoryService] Sorted files:', sortedFiles.map(f => ({ name: f.name, path: f.filePath })));
      
      return sortedFiles;
    } catch (error) {
      console.error('[SessionHistoryService] Error reading sessions directory:', error);
      return [];
    }
  }

  /**
   * Recursively scan directories for .jsonl session files
   */
  private async scanDirectoryRecursive(dirPath: string, sessionFiles: SessionFile[]): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await this.scanDirectoryRecursive(fullPath, sessionFiles);
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          const stats = await fs.promises.stat(fullPath);
          
          // Extract session info from filename
          // Format: rollout-2025-08-26T11-03-54-4cc89fb8-f80b-4445-84dd-d3c9fc973e64.jsonl
          const sessionId = this.extractSessionIdFromFilename(entry.name);
          const timestamp = this.extractTimestampFromFilename(entry.name) || stats.mtime;
          
          sessionFiles.push({
            sessionId,
            filePath: fullPath,
            timestamp,
            size: stats.size,
            name: this.generateSessionName(sessionId, timestamp)
          });
        }
      }
    } catch (error) {
      console.error('Error scanning directory:', dirPath, error);
    }
  }

  /**
   * Extract session ID from Codex session filename
   */
  private extractSessionIdFromFilename(filename: string): string {
    // Remove .jsonl extension
    const nameWithoutExt = filename.replace('.jsonl', '');
    
    // Try to extract UUID from the end of the filename
    const uuidMatch = nameWithoutExt.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i);
    if (uuidMatch) {
      return uuidMatch[1];
    }
    
    // Fallback to the full filename without extension
    return nameWithoutExt;
  }

  /**
   * Extract timestamp from Codex session filename
   */
  private extractTimestampFromFilename(filename: string): Date | null {
    // Extract timestamp from format: rollout-2025-08-26T11-03-54-...
    const timestampMatch = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    if (timestampMatch) {
      // Convert format from 2025-08-26T11-03-54 to 2025-08-26T11:03:54
      const isoTimestamp = timestampMatch[1].replace(/-(\d{2})-(\d{2})$/, ':$1:$2');
      return new Date(isoTimestamp);
    }
    return null;
  }

  /**
   * Parse a session file and extract conversation history
   */
  public async parseSession(sessionFile: SessionFile): Promise<ParsedSession | null> {
    try {
      const content = await fs.promises.readFile(sessionFile.filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      const entries: any[] = [];
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          // Filter for conversation entries (messages, tool calls, etc.)
          if (this.isConversationEntry(entry)) {
            entries.push(entry);
          }
        } catch (parseError) {
          console.warn('Failed to parse line in session file:', line);
        }
      }

      return {
        sessionId: sessionFile.sessionId,
        timestamp: sessionFile.timestamp,
        entries,
        name: sessionFile.name,
        messageCount: entries.length
      };
    } catch (error) {
      console.error('Error parsing session file:', sessionFile.filePath, error);
      return null;
    }
  }

  /**
   * Get conversation history from a specific session
   */
  public async getSessionHistory(sessionId: string): Promise<ParsedSession | null> {
    const sessionFiles = await this.getSessionFiles();
    const targetFile = sessionFiles.find(file => file.sessionId === sessionId);
    
    if (!targetFile) {
      console.error('Session file not found:', sessionId);
      return null;
    }

    return this.parseSession(targetFile);
  }

  /**
   * Get all parsed sessions (limited to first N for performance)
   */
  public async getAllSessions(limit: number = 50): Promise<ParsedSession[]> {
    const sessionFiles = await this.getSessionFiles();
    const sessions: ParsedSession[] = [];

    for (const file of sessionFiles.slice(0, limit)) {
      const parsedSession = await this.parseSession(file);
      if (parsedSession) {
        sessions.push(parsedSession);
      }
    }

    return sessions;
  }

  private generateSessionName(sessionId: string, timestamp: Date): string {
    const dateStr = timestamp.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Use first 8 characters of session ID as identifier
    const shortId = sessionId.substring(0, 8);
    return `Session ${shortId} - ${dateStr}`;
  }

  private isConversationEntry(entry: any): boolean {
    // Check if this entry represents part of the conversation
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    // Look for actual conversation entries based on the new format
    return (
      (entry.type === 'message' && entry.role && entry.content) ||
      (entry.type === 'function_call' && entry.name) ||
      (entry.type === 'function_call_output' && entry.call_id)
    );
  }

  /**
   * Convert session entries to a format compatible with resume functionality
   */
  public convertToResumeFormat(session: ParsedSession): any[] {
    const resumeHistory: any[] = [];

    for (const entry of session.entries) {
      // Handle the new JSONL format
      if (entry.type === 'message' && entry.role && entry.content) {
        // Extract text content from the new format
        const textContent = entry.content
          .filter((item: any) => item.type === 'input_text' || item.type === 'output_text')
          .map((item: any) => ({ type: 'text', text: item.text }));
        
        if (textContent.length > 0) {
          resumeHistory.push({
            role: entry.role,
            content: textContent,
            id: entry.id
          });
        }
      }
      // We could also include function calls for context, but for now focus on messages
    }

    return resumeHistory;
  }
}