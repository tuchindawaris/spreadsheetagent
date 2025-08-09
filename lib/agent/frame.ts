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
  
  // Group tables by base sheet name for clearer presentation
  const tableGroups: Record<string, typeof sheetModel.tables> = {};
  sheetModel.tables.forEach(table => {
    const baseName = table.name.split('_')[0];
    if (!tableGroups[baseName]) tableGroups[baseName] = [];
    tableGroups[baseName].push(table);
  });
  
  // Build enhanced sheet summary
  const sheetSummary = Object.entries(tableGroups).map(([baseName, tables]) => {
    if (tables.length === 1) {
      // Single table - simple format
      const table = tables[0];
      const columnDetails = table.columns.map(c => {
        const sample = c.sample !== null && c.sample !== undefined 
          ? ` (sample: "${String(c.sample).slice(0, 20)}${String(c.sample).length > 20 ? '...' : ''}")`
          : '';
        return `${c.name}${sample}`;
      }).join(', ');
      
      return `Table "${table.name}": ${columnDetails} (${table.rows.length} rows)`;
    } else {
      // Multiple tables from same sheet
      return `Sheet "${baseName}" contains ${tables.length} tables:\n` + 
        tables.map(table => {
          const columnDetails = table.columns.map(c => `${c.name}`).join(', ');
          const tableDesc = table.name.replace(baseName + '_', '');
          return `  - ${tableDesc}: ${columnDetails} (${table.rows.length} rows)`;
        }).join('\n');
    }
  }).join('\n\n');
  
  // Log available data structure
  const totalRows = sheetModel.tables.reduce((sum, t) => sum + t.rows.length, 0);
  const tableCount = sheetModel.tables.length;
  
  eventBus.publish(sessionId, { 
    type: 'thought', 
    message: `📋 Analyzing spreadsheet structure: ${tableCount} table(s), ${totalRows} total rows` 
  });
  
  const systemPrompt = `You are analyzing spreadsheet data to understand user requests. 
The spreadsheet may contain multiple tables that were automatically detected.
Tables from the same sheet may be split if there were section headers or gaps in the data.

Given a user query and sheet structure, identify the intent, which columns are needed, and provide a brief summary.

Important: 
- Carefully match user intent to column names across ALL tables
- If tables are split versions of the same data (e.g., "Sheet1_Q1_Sales", "Sheet1_Q2_Sales"), recognize this pattern
- For queries about specific sections (Q1, Q2, etc.), identify the relevant table
- For queries spanning multiple sections, identify all relevant tables
- Be case-insensitive when matching column names
- Consider that similar columns may appear in multiple tables

Available tables with sample data:
${sheetSummary}

Return a JSON object with:
- intent: what the user wants to do (be specific about the analysis type)
- neededColumns: array of exact column names needed for the analysis (case-sensitive as they appear)
- targetTables: array of table names that contain the needed data
- summary: brief description of the task that will guide JavaScript code generation
- reasoning: your thought process for column and table selection (this helps debugging)`;

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
  
  // Log the reasoning
  if (result.reasoning) {
    eventBus.publish(sessionId, { 
      type: 'thought', 
      message: `🧠 Table/column selection: ${result.reasoning}` 
    });
  }
  
  // Store target tables in frame for later use
  return {
    intent: result.intent,
    neededColumns: result.neededColumns || [],
    summary: result.summary,
    targetTables: result.targetTables || []
  };
}