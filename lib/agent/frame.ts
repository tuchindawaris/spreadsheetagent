import OpenAI from 'openai';
import { Frame, SheetModel, AgentContext } from '../types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function frameTask(
  context: AgentContext
): Promise<Frame> {
  const { prompt, sheetModel, gptCallCount, maxGptCalls } = context;
  
  if (gptCallCount >= maxGptCalls) {
    throw new Error('Max GPT calls exceeded');
  }
  
  // Build sheet summary
  const sheetSummary = sheetModel.tables.map(table => 
    `Table "${table.name}": ${table.columns.map(c => c.name).join(', ')} (${table.rows.length} rows)`
  ).join('\n');
  
  const systemPrompt = `You are analyzing spreadsheet data. Given a user query and sheet structure, 
identify the intent, which columns are needed, and provide a brief summary.

Available sheets:
${sheetSummary}

Return a JSON object with:
- intent: what the user wants to do
- neededColumns: array of column names needed
- summary: brief description of the task`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 500
  });
  
  context.gptCallCount++;
  
  const result = JSON.parse(response.choices[0].message.content!);
  
  return {
    intent: result.intent,
    neededColumns: result.neededColumns || [],
    summary: result.summary
  };
}