import OpenAI from 'openai';
import { Frame, SheetModel, AgentContext } from '../types';
import { eventBus } from '../bus';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function frameTask(
  context: AgentContext
): Promise<Frame> {
  const { prompt, sheetModel, gptCallCount, maxGptCalls, sessionId } = context;
  
  if (gptCallCount >= maxGptCalls) {
    throw new Error('Max GPT calls exceeded');
  }
  
  // Build sheet summary with more detail
  const sheetSummary = sheetModel.tables.map(table => {
    const columnDetails = table.columns.map(c => {
      const sample = c.sample !== null && c.sample !== undefined 
        ? ` (sample: "${String(c.sample).slice(0, 20)}${String(c.sample).length > 20 ? '...' : ''}")`
        : '';
      return `${c.name}${sample}`;
    }).join(', ');
    
    return `Table "${table.name}": ${columnDetails} (${table.rows.length} rows)`;
  }).join('\n');
  
  // Log available data structure
  eventBus.publish(sessionId, { 
    type: 'thought', 
    message: `📋 Analyzing spreadsheet structure: ${sheetModel.tables.length} sheet(s), ${sheetModel.tables.reduce((sum, t) => sum + t.rows.length, 0)} total rows` 
  });
  
  const systemPrompt = `You are analyzing spreadsheet data to understand user requests. 
Given a user query and sheet structure, identify the intent, which columns are needed, and provide a brief summary.

Important: Carefully match user intent to column names. For example:
- If user asks for "payment amounts" and there's an "Amount" column and a "Payment" column, they likely want "Amount"
- If user asks for "customer names" and there's a "Customer" or "Client" column, use that
- Consider the data type and sample values in columns when matching (numbers for amounts, strings for names)
- Look for partial matches and synonyms
- Be case-insensitive when matching column names

Available sheets with sample data:
${sheetSummary}

Return a JSON object with:
- intent: what the user wants to do (be specific about the analysis type)
- neededColumns: array of exact column names needed for the analysis (case-sensitive as they appear)
- summary: brief description of the task that will guide JavaScript code generation
- reasoning: your thought process for column selection (this helps debugging)`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 500
  });
  
  context.gptCallCount++;
  
  const result = JSON.parse(response.choices[0].message.content!);
  
  // Log the reasoning
  if (result.reasoning) {
    eventBus.publish(sessionId, { 
      type: 'thought', 
      message: `🧠 Column selection logic: ${result.reasoning}` 
    });
  }
  
  return {
    intent: result.intent,
    neededColumns: result.neededColumns || [],
    summary: result.summary
  };
}