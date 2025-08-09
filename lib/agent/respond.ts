import { Frame, AgentContext, AnswerPayload, ExecResultWithAccess } from '../types';

type ExecResult = ExecResultWithAccess;

export async function respond(
  frame: Frame,
  execResult: ExecResult,
  context: AgentContext
): Promise<AnswerPayload> {
  // Extract accessed columns from execution result
  const accessedColumns = execResult.dataAccess 
    ? Array.from(execResult.dataAccess.accessedColumns)
    : [];
  
  // Try to infer the operation type from the intent
  let operation = 'analysis';
  const intentLower = frame.intent.toLowerCase();
  if (intentLower.includes('group') || intentLower.includes('by')) {
    operation = 'groupBy';
  } else if (intentLower.includes('count')) {
    operation = 'count';
  } else if (intentLower.includes('sum') || intentLower.includes('total')) {
    operation = 'sum';
  } else if (intentLower.includes('average') || intentLower.includes('mean')) {
    operation = 'average';
  } else if (intentLower.includes('list') || intentLower.includes('show')) {
    operation = 'list';
  }
  
  // Pass through any result type with context
  let tableJson = undefined;
  if (execResult.result !== null && execResult.result !== undefined) {
    tableJson = execResult.result;
  }
  
  return {
    markdown: '', // No markdown needed
    tableJson,
    analysisContext: {
      accessedColumns,
      intent: frame.intent,
      operation
    }
  };
}