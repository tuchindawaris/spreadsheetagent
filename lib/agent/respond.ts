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
  const { gptCallCount, maxGptCalls, prompt } = context;
  
  if (gptCallCount >= maxGptCalls) {
    // Return simple result if at limit
    return {
      markdown: `Based on your request: "${prompt}"\n\nResult: ${JSON.stringify(execResult.result).slice(0, 200)}...`,
      tableJson: execResult.result
    };
  }
  
  const systemPrompt = `You are formatting JavaScript data analysis results for the user.
Given the execution results from JavaScript/SheetJS analysis, create a clear, concise markdown response.

Guidelines:
- Be direct and helpful
- Use markdown formatting for readability
- Include key insights from the data
- Format numbers nicely (e.g., use commas for thousands)
- If the result is tabular data, mention it will be displayed in a table below
- Highlight important findings with **bold** text`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Original question: ${prompt}\n\nAnalysis results:\n${execResult.stdout}\n\nData: ${JSON.stringify(execResult.result).slice(0, 1000)}` 
      }
    ],
    temperature: 0.5,
    max_tokens: 500
  });
  
  context.gptCallCount++;
  
  const markdown = response.choices[0].message.content || 'Analysis complete.';
  
  // Check if result is table-like
  let tableJson = undefined;
  if (Array.isArray(execResult.result) && execResult.result.length > 0) {
    tableJson = execResult.result;
  }
  
  return {
    markdown,
    tableJson
  };
}