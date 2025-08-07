import OpenAI from 'openai';
import { Frame, AgentContext } from '../types';
import { ExecResult } from './exec-code';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export type ReflectionResult = 'done' | 'retry';

export async function reflect(
  frame: Frame,
  execResult: ExecResult,
  context: AgentContext
): Promise<ReflectionResult> {
  const { gptCallCount, maxGptCalls } = context;
  
  if (gptCallCount >= maxGptCalls) {
    return 'done'; // Force completion if at limit
  }
  
  if (!execResult.ok) {
    return 'retry'; // Always retry on error
  }
  
  const systemPrompt = `You are evaluating code execution results.
Given the user's intent and the execution result, determine if the result is satisfactory.

Respond with either "done" if the result answers the user's question, or "retry" if it needs improvement.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Intent: ${frame.intent}\nStdout: ${execResult.stdout}\nResult: ${JSON.stringify(execResult.result).slice(0, 500)}` 
      }
    ],
    temperature: 0.3,
    max_tokens: 10
  });
  
  context.gptCallCount++;
  
  const decision = response.choices[0].message.content?.trim().toLowerCase();
  return decision === 'retry' ? 'retry' : 'done';
}