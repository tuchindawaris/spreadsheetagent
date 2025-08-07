export type SheetModel = { tables: Table[]; issues: string[] };

export interface Table {
  name: string;
  rows: any[];                // raw values; sufficient for MVP
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

export interface Frame {
  intent: string;
  neededColumns: string[];
  summary: string;
}

export type AgentEvent =
  | { type: 'connected' }
  | { type: 'highlight'; sheetId: string; range: string }
  | { type: 'thought'; message: string }
  | { type: 'answer'; content: AnswerPayload };

export interface AnswerPayload {
  markdown: string;
  tableJson?: unknown;
  vegaLiteSpec?: unknown;
}

export interface AgentContext {
  sessionId: string;
  prompt: string;
  sheetModel: SheetModel;
  maxRetries: number;
  maxGptCalls: number;
  gptCallCount: number;
}