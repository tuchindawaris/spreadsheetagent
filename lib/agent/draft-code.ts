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
  
  const systemPrompt = `You are a JavaScript code generator for spreadsheet data analysis using SheetJS/XLSX library. 
Given a user intent and data structure, write JavaScript code to analyze the data.

Rules:
- The data is available as an array called 'data' where each element is an object with column names as keys
- Use JavaScript array methods (map, filter, reduce, etc.) for data manipulation
- Use lodash functions when helpful (available as '_')
- Return results that can be serialized to JSON
- Store the final result by assigning to 'result' (do NOT declare it with const/let/var, just use: result = ...)
- The variable 'result' already exists, so just assign to it directly
- Use console.log to output intermediate results or insights
- Keep code concise and efficient
- DO NOT use any pandas, numpy, or Python syntax
- DO NOT use import statements
- DO NOT declare 'result' with const/let/var - it already exists

Available columns: ${region.table.columns.map((c: any) => c.name).join(', ')}
Row count: ${region.table.rows.length}
First row example: ${JSON.stringify(region.table.rows[0] || {})}

Example code pattern:
// Process data
const processed = data.map(row => row.someColumn);
// Assign to result (no const/let/var)
result = processed;`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Task: ${frame.intent}\nSummary: ${frame.summary}` }
    ],
    tools: [{
      type: 'function',
      function: {
        name: 'javascript_run',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string' }
          },
          required: ['code']
        }
      }
    }],
    tool_choice: { type: 'function', function: { name: 'javascript_run' } },
    temperature: 0.3,
    max_tokens: 1000
  });
  
  context.gptCallCount++;
  
  const toolCall = response.choices[0].message.tool_calls?.[0];
  if (!toolCall || toolCall.function.name !== 'javascript_run') {
    throw new Error('Failed to generate code');
  }
  
  const args = JSON.parse(toolCall.function.arguments);
  console.log('=== GENERATED CODE ===');
  console.log(args.code);
  console.log('=== END CODE ===');
  
  return args.code;
}