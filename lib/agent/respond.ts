import OpenAI from 'openai';
import { Frame, AgentContext, AnswerPayload } from '../types';
import { ExecResult } from './exec-code';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function respond(
  frame: Frame,
  execResult: ExecResult,
  context: AgentContext
): Promise<AnswerPayload> {
  // Simply return the execution result without additional formatting
  let tableJson = undefined;
  
  // Check if result is table-like
  if (Array.isArray(execResult.result) && execResult.result.length > 0) {
    tableJson = execResult.result;
  } else if (execResult.result && typeof execResult.result === 'object') {
    // If it's a single object, wrap it in an array
    tableJson = [execResult.result];
  }
  
  return {
    markdown: '', // No markdown needed
    tableJson
  };
}