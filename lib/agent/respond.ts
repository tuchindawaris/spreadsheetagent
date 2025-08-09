// lib/agent/respond.ts
import { Frame, AgentContext, AnswerPayload, ExecResult } from '../types';

export async function respond(
  frame: Frame,
  execResult: ExecResult,
  context: AgentContext
): Promise<AnswerPayload> {
  // Extract accessed range info
  let accessedRange = '';
  if (execResult.dataAccess) {
    const minRow = Math.min(...Array.from(execResult.dataAccess.accessedRows));
    const maxRow = Math.max(...Array.from(execResult.dataAccess.accessedRows));
    const minCol = Math.min(...Array.from(execResult.dataAccess.accessedColumns));
    const maxCol = Math.max(...Array.from(execResult.dataAccess.accessedColumns));
    
    const colToLetter = (col: number) => {
      let letter = '';
      let temp = col;
      while (temp >= 0) {
        letter = String.fromCharCode(65 + (temp % 26)) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      return letter;
    };
    
    accessedRange = `${colToLetter(minCol)}${minRow + 1}:${colToLetter(maxCol)}${maxRow + 1}`;
  }
  
  // Infer operation type from intent
  let operation = 'analysis';
  const intentLower = frame.intent.toLowerCase();
  if (intentLower.includes('group')) operation = 'groupBy';
  else if (intentLower.includes('count')) operation = 'count';
  else if (intentLower.includes('sum') || intentLower.includes('total')) operation = 'sum';
  else if (intentLower.includes('average') || intentLower.includes('mean')) operation = 'average';
  else if (intentLower.includes('list') || intentLower.includes('show')) operation = 'list';
  
  return {
    markdown: '', // Let DataDisplay handle formatting
    data: execResult.result,
    analysisContext: {
      accessedRange,
      intent: frame.intent,
      operation
    }
  };
}

// lib/agent/calculate-ranges.ts - Simplified version
import { DataAccessInfo, Sheet } from '../types';

export interface HighlightRange {
  sheetId: string;
  range: string;
  description: string;
}

export function calculateHighlightRanges(
  dataAccess: DataAccessInfo,
  sheetName: string
): HighlightRange[] {
  if (!dataAccess || dataAccess.accessedCells.length === 0) {
    return [];
  }
  
  const rows = Array.from(dataAccess.accessedRows).sort((a, b) => a - b);
  const cols = Array.from(dataAccess.accessedColumns).sort((a, b) => a - b);
  
  if (rows.length === 0 || cols.length === 0) return [];
  
  const colToLetter = (col: number) => {
    let letter = '';
    let temp = col;
    while (temp >= 0) {
      letter = String.fromCharCode(65 + (temp % 26)) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };
  
  // Create a single range encompassing all accessed cells
  const startCol = colToLetter(Math.min(...cols));
  const endCol = colToLetter(Math.max(...cols));
  const startRow = Math.min(...rows) + 1;
  const endRow = Math.max(...rows) + 1;
  
  return [{
    sheetId: sheetName,
    range: `${startCol}${startRow}:${endCol}${endRow}`,
    description: `${rows.length} rows × ${cols.length} columns`
  }];
}