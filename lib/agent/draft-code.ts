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
  
  let systemPrompt = `You are a JavaScript code generator for spreadsheet data analysis. 
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
First 3 rows example: ${JSON.stringify(region.table.rows.slice(0, 3) || {}, null, 2)}`;

  // Add retry context if available
  if (retryContext && retryContext.previousAttempts.length > 0) {
    systemPrompt += `\n\nIMPORTANT - PREVIOUS ATTEMPTS FAILED:`;
    
    retryContext.previousAttempts.forEach((attempt, idx) => {
      systemPrompt += `\n\nAttempt ${idx + 1}:`;
      systemPrompt += `\nCode: ${attempt.code}`;
      if (attempt.error) {
        systemPrompt += `\nError: ${attempt.error}`;
      }
      if (attempt.stdout) {
        systemPrompt += `\nConsole output: ${attempt.stdout}`;
      }
      if (attempt.result !== undefined) {
        systemPrompt += `\nResult: ${JSON.stringify(attempt.result).slice(0, 200)}`;
      }
    });
    
    systemPrompt += `\n\nFailure reason: ${retryContext.failureReason}`;
    if (retryContext.gptFeedback) {
      systemPrompt += `\nSpecific issue: ${retryContext.gptFeedback}`;
    }
    
    // Add specific guidance based on failure reason
    switch (retryContext.failureReason) {
      case 'all_nulls':
        systemPrompt += `\n\nThe previous code returned all null values. This usually means:
- You're accessing a column that doesn't exist (check exact column names including case and spaces)
- The column name has typos or incorrect format
- You need to handle nested data structures differently
Double-check the exact column names and access them correctly.`;
        break;
      case 'all_whitespace':
        systemPrompt += `\n\nThe previous code returned all empty strings/whitespace. This means:
- The column exists but contains empty values
- You might need to trim() values or filter out empty ones
- Consider looking at a different column that actually has data`;
        break;
      case 'wrong_column':
      case 'irrelevant_result':
        systemPrompt += `\n\nThe result doesn't match what the user asked for. Make sure to:
- Focus on the specific data the user requested
- Return the right type of result (array, summary, calculation, etc.)
- Address the user's actual question, not just process random data`;
        break;
      case 'type_mismatch':
        systemPrompt += `\n\nThe result type doesn't match expectations. Ensure you return the appropriate data structure.`;
        break;
    }
    
    systemPrompt += `\n\nGenerate NEW code that fixes these issues. Do NOT repeat the same mistakes.`;
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
  console.log('=== GENERATED CODE ===');
  if (retryContext) {
    console.log(`Attempt #${retryContext.previousAttempts.length + 1} (Retry due to: ${retryContext.failureReason})`);
  }
  console.log(args.code);
  console.log('=== END CODE ===');
  
  return args.code;
}