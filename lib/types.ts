// lib/types.ts - Fixed to match actual usage
export interface Sheet {
  name: string;
  data: any[][];  // Raw 2D array of cell values
  merges: Array<{
    s: { r: number; c: number }; // start row/col
    e: { r: number; c: number }; // end row/col
  }>;
  dimensions: {
    rows: number;
    cols: number;
  };
}

export interface SheetModel {
  sheets: Sheet[];
}

export interface Frame {
  intent: string;
  summary: string;
  targetSheet?: string;
  dataRange?: { 
    startRow?: number; 
    endRow?: number; 
    startCol?: number; 
    endCol?: number;
  };
}

export type AgentEvent =
  | { type: 'connected' }
  | { type: 'highlight'; sheetId: string; range: string }
  | { type: 'thought'; message: string }
  | { type: 'answer'; content: AnswerPayload };

export interface AnswerPayload {
  markdown: string;
  data?: any;
  analysisContext?: {
    accessedRange?: string;
    intent: string;
    operation?: string;
  };
}

export interface AgentContext {
  sessionId: string;
  prompt: string;
  sheetModel: SheetModel;
  maxRetries: number;
  maxGptCalls: number;
  gptCallCount: number;
}

export interface RetryContext {
  previousAttempts: {
    code: string;
    error?: string;
    result?: any;
    stdout: string;
  }[];
  failureReason: string;
  gptFeedback?: string;
}

export interface DataAccessInfo {
  accessedRows: Set<number>;
  accessedColumns: Set<number>;
  accessedCells: Array<{ row: number; col: number }>;
}

export interface ExecResult {
  ok: boolean;
  stdout: string;
  result: any;
  error?: string;
  dataAccess?: DataAccessInfo;
}

// Legacy types kept for reference but not used
export interface Table {
  name: string;
  rows: any[];
  columns: ColumnMeta[];
  hierarchy?: HierarchyMeta;
}

export interface ColumnMeta {
  name: string;
  type: 'string' | 'number' | 'date' | 'mixed';
  sample: any;
}

export interface HierarchyMeta {
  levels: string[];
  parentChild: Map<string, string[]>;
}