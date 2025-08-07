import OpenAI from 'openai';
import { Frame, AgentContext } from '../types';
import { RegionSelection } from './select-region';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function draftCode(
  frame: Frame,
  region: RegionSelection,
  context: AgentContext
): Promise<string> {
  const { gptCallCount, maxGptCalls } = context;
  
  if (gptCallCount >= maxGptCalls) {
    throw new Error('Max GPT calls exceeded');
  }
  
  const systemPrompt = `You are a Python code generator for data analysis. 
Given a user intent and data structure, write Python code to analyze the data.

Rules:
- Use pandas for data manipulation
- The data is available as a DataFrame called 'df'
- Return results that can be serialized to JSON
- Keep code concise and efficient
- Always print the final result

Available columns: ${region.table.columns.map((c: any) => c.name).join(', ')}
Row count: ${region.table.rows.length}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Task: ${frame.intent}\nSummary: ${frame.summary}` }
    ],
    tools: [{
      type: 'function',
      function: {
        name: 'python_run',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string' }
          },
          required: ['code']
        }
      }
    }],
    tool_choice: { type: 'function', function: { name: 'python_run' } },
    temperature: 0.3,
    max_tokens: 1000
  });
  
  context.gptCallCount++;
  
  const toolCall = response.choices[0].message.tool_calls?.[0];
  if (!toolCall || toolCall.function.name !== 'python_run') {
    throw new Error('Failed to generate code');
  }
  
  const args = JSON.parse(toolCall.function.arguments);
  console.log('=== GENERATED CODE ===');
  console.log(args.code);
  console.log('=== END CODE ===');
  
  return args.code;
}