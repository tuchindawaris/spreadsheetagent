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
    const rows = Array.from(execResult.dataAccess.accessedRows);
    const cols = Array.from(execResult.dataAccess.accessedColumns);
    
    if (rows.length > 0 && cols.length > 0) {
      const minRow = Math.min(...rows);
      const maxRow = Math.max(...rows);
      const minCol = Math.min(...cols);
      const maxCol = Math.max(...cols);
      
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