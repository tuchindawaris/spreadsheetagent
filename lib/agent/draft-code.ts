// lib/agent/draft-code.ts
import OpenAI from 'openai';
import { Frame, AgentContext, RetryContext } from '../types';
import { RegionSelection } from './select-region';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function draftCode(
  frame: Frame,
  region: RegionSelection,
  context: AgentContext,
  retryContext?: RetryContext
): Promise<string> {
  const { gptCallCount, maxGptCalls } = context;
  
  if (gptCallCount >= maxGptCalls) {
    throw new Error('Max GPT calls exceeded');
  }
  
  // Handle empty data case
  if (!region.data || region.data.length === 0) {
    throw new Error('No data available in the selected region');
  }
  
  // Show preview of the data structure
  const preview = region.data.slice(0, 5).map((row, idx) => {
    if (!row || !Array.isArray(row)) return `Row ${idx}: [empty or invalid]`;
    return `Row ${idx}: [${row.slice(0, 5).map(cell => 
      cell === null ? 'null' : JSON.stringify(cell)
    ).join(', ')}${row.length > 5 ? ', ...' : ''}]`;
  }).join('\n');
  
  const firstRow = region.data[0];
  const columnCount = firstRow ? firstRow.length : 0;
  
  let systemPrompt = `You are a JavaScript code generator for spreadsheet data analysis.
Given a user intent and raw spreadsheet data, write JavaScript code to analyze the data.

Data Structure:
- 'rawData': 2D array of cell values (${region.data.length} rows × ${columnCount} columns)
- 'data': Array of objects where first ${region.headerRows} row(s) are used as headers
- 'headers': Array of column headers extracted from the first row

Rules:
- The data is available as 'data' (array of objects) and 'rawData' (2D array)
- Use JavaScript array methods for data manipulation
- Use lodash functions when helpful (available as '_')
- Return results that can be serialized to JSON
- Store the final result by assigning to 'result' (do NOT declare it)
- Use console.log for insights
- Keep code concise and efficient

Data preview:
${preview}

Headers detected: ${firstRow ? firstRow.slice(0, 10).join(', ') + (firstRow.length > 10 ? ', ...' : '') : '[No headers found]'}`;


  // Add retry context if available
  if (retryContext && retryContext.previousAttempts.length > 0) {
    systemPrompt += `\n\nPREVIOUS ATTEMPTS FAILED:`;
    
    retryContext.previousAttempts.forEach((attempt, idx) => {
      systemPrompt += `\n\nAttempt ${idx + 1}:`;
      systemPrompt += `\nCode: ${attempt.code}`;
      if (attempt.error) {
        systemPrompt += `\nError: ${attempt.error}`;
      }
      if (attempt.result !== undefined) {
        systemPrompt += `\nResult: ${JSON.stringify(attempt.result).slice(0, 200)}`;
      }
    });
    
    systemPrompt += `\n\nFix these issues in your new code.`;
  }

  const userPrompt = `Task: ${frame.intent}
Summary: ${frame.summary}
User's original question: ${context.prompt}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
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
  console.log('Generated code:', args.code);
  
  return args.code;
}