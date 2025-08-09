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

Available utilities:
- '_' object with lodash-like functions: groupBy, sumBy, sortBy, uniqBy, countBy, mapValues, sum, map, filter
- 'findColumn(row, possibleNames)': Helper to find column by name (handles case/whitespace variations)
  Example: const amountCol = findColumn(data[0], ['amount', 'total', 'value', 'sum']);

CRITICAL DEBUGGING STEPS:
1. ALWAYS start by logging the available columns: console.log('Available columns:', Object.keys(data[0]));
2. When looking for amount/total columns, use findColumn and log the result
3. If a column is not found, log all column names to help debug

IMPORTANT Rules:
- Column headers may have extra whitespace - use findColumn() or trim()
- Numeric values might be strings with commas (e.g., "1,234.56") - parse them properly
- The data is available as 'data' (array of objects) and 'rawData' (2D array)
- Use console.log liberally to debug data structure
- Store the final result by assigning to 'result' (do NOT declare it with let/const)
- When summing amounts, verify the column exists before using it

Example debugging pattern:
console.log('Available columns:', Object.keys(data[0]));
const amountCol = findColumn(data[0], ['amount', 'total', 'payment', 'value']);
console.log('Found amount column:', amountCol);
if (!amountCol) {
  console.log('Could not find amount column. Available columns:', headers);
}

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