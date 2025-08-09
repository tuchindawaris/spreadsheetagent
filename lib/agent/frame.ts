// lib/agent/frame.ts
import OpenAI from 'openai';
import { Frame, SheetModel, AgentContext } from '../types';
import { eventBus } from '../bus';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function frameTask(context: AgentContext): Promise<Frame> {
  const { prompt, sheetModel, gptCallCount, maxGptCalls, sessionId } = context;
  
  if (gptCallCount >= maxGptCalls) {
    throw new Error('Max GPT calls exceeded');
  }
  
  // Build sheet summary
  const sheetSummary = sheetModel.sheets.map(sheet => {
    // Sample first few rows to understand structure
    const sampleRows = sheet.data.slice(0, 5);
    const preview = sampleRows.map((row, idx) => {
      if (!row || !Array.isArray(row)) return `Row ${idx}: [empty]`;
      return `Row ${idx}: ${row.slice(0, 5).map(cell => 
        cell === null ? '[empty]' : String(cell).slice(0, 20)
      ).join(' | ')}${row.length > 5 ? '...' : ''}`;
    }).join('\n');
    
    return `Sheet "${sheet.name}": ${sheet.dimensions.rows} rows × ${sheet.dimensions.cols} columns
Preview:
${preview}`;
  }).join('\n\n');
  
  eventBus.publish(sessionId, { 
    type: 'thought', 
    message: `📋 Analyzing ${sheetModel.sheets.length} sheet(s)` 
  });
  
  const systemPrompt = `You are analyzing raw spreadsheet data to understand user requests.
The data is provided as 2D arrays where each sheet contains rows and columns of raw cell values.

Given a user query and sheet structure, identify:
1. Which sheet contains the relevant data
2. What rows/columns likely contain the data needed
3. Whether the first row(s) are headers
4. The general intent of the analysis

Available sheets:
${sheetSummary}

Return a JSON object with:
- intent: what the user wants to do
- summary: brief description of the task
- targetSheet: name of the sheet to analyze
- dataRange: suggested range of rows/columns to analyze (optional, can be null for full sheet)
- headerRows: estimated number of header rows (usually 1)`;

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
  
  eventBus.publish(sessionId, { 
    type: 'thought', 
    message: `🎯 Task: ${result.intent}` 
  });
  
  return {
    intent: result.intent,
    summary: result.summary,
    targetSheet: result.targetSheet,
    dataRange: result.dataRange
  };
}
