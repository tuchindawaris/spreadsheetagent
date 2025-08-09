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

// lib/agent/select-region.ts
import { Frame, SheetModel } from '../types';

export interface RegionSelection {
  sheetId: string;
  range: string;
  data: any[][];
  headerRows: number;
}

export function selectRegion(frame: Frame, sheetModel: SheetModel): RegionSelection {
  // Find the target sheet
  const sheet = sheetModel.sheets.find(s => s.name === frame.targetSheet) || sheetModel.sheets[0];
  
  if (!sheet || !sheet.data || sheet.data.length === 0) {
    throw new Error('No valid data found in the selected sheet');
  }
  
  // Use the full sheet data by default
  let data = sheet.data;
  let startRow = 0;
  let endRow = sheet.dimensions.rows - 1;
  let startCol = 0;
  let endCol = sheet.dimensions.cols - 1;
  
  // If a specific range was suggested, extract it
  if (frame.dataRange) {
    const range = frame.dataRange;
    startRow = range.startRow || 0;
    endRow = Math.min(range.endRow || endRow, sheet.data.length - 1);
    startCol = range.startCol || 0;
    endCol = Math.min(range.endCol || endCol, (sheet.data[0]?.length || 1) - 1);
    
    // Extract the subset of data
    data = [];
    for (let r = startRow; r <= endRow; r++) {
      const row = [];
      for (let c = startCol; c <= endCol; c++) {
        row.push(sheet.data[r]?.[c] ?? null);
      }
      data.push(row);
    }
  }
  
  // Convert to Excel-style range notation
  const colToLetter = (col: number) => {
    let letter = '';
    let temp = col;
    while (temp >= 0) {
      letter = String.fromCharCode(65 + (temp % 26)) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };
  
  const range = `${colToLetter(startCol)}${startRow + 1}:${colToLetter(endCol)}${endRow + 1}`;
  
  return {
    sheetId: sheet.name,
    range,
    data,
    headerRows: 1 // Default assumption, could be smarter
  };
}

// lib/agent/exec-code.ts
import { RegionSelection } from './select-region';
import { DataAccessInfo, ExecResult } from '../types';

export async function executeCode(code: string, region: RegionSelection): Promise<ExecResult> {
  console.log('=== EXECUTING CODE ===');
  console.log('Sheet:', region.sheetId);
  console.log('Range:', region.range);
  console.log('Data shape:', region.data.length, 'rows');
  
  const dataAccess: DataAccessInfo = {
    accessedRows: new Set(),
    accessedColumns: new Set(),
    accessedCells: []
  };
  
  try {
    // Handle empty data gracefully
    if (!region.data || region.data.length === 0) {
      return {
        ok: false,
        stdout: '',
        result: null,
        error: 'No data available in the selected region',
        dataAccess
      };
    }
    
    // Convert 2D array to array of objects using first row as headers
    const firstRow = region.data[0];
    if (!firstRow || !Array.isArray(firstRow)) {
      return {
        ok: false,
        stdout: '',
        result: null,
        error: 'Invalid data format - first row is not an array',
        dataAccess
      };
    }
    
    const headers = firstRow.map((h, i) => h || `Col${i + 1}`);
    const dataRows = region.data.slice(region.headerRows).map((row, rowIndex) => {
      const obj: any = {};
      if (Array.isArray(row)) {
        headers.forEach((header, colIndex) => {
          obj[header] = row[colIndex];
          // Track access when properties are accessed
          if (row[colIndex] !== null && row[colIndex] !== undefined) {
            dataAccess.accessedRows.add(rowIndex);
            dataAccess.accessedColumns.add(colIndex);
            dataAccess.accessedCells.push({ row: rowIndex, col: colIndex });
          }
        });
      }
      return obj;
    });
    
    // Create execution context
    const sandbox = {
      data: dataRows,
      rawData: region.data, // Also provide raw 2D array
      headers,
      result: null,
      console: {
        log: (...args: any[]) => {
          sandbox.stdout += args.map(a => 
            typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
          ).join(' ') + '\n';
        }
      },
      stdout: '',
      // Basic lodash-like utilities
      _: {
        groupBy: (arr: any[], key: string) => {
          return arr.reduce((groups, item) => {
            const group = item[key];
            if (!groups[group]) groups[group] = [];
            groups[group].push(item);
            return groups;
          }, {});
        },
        sumBy: (arr: any[], key: string) => {
          return arr.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
        },
        sortBy: (arr: any[], key: string) => {
          return [...arr].sort((a, b) => {
            if (a[key] < b[key]) return -1;
            if (a[key] > b[key]) return 1;
            return 0;
          });
        }
      }
    };
    
    // Execute the code
    const execFunc = new Function(
      'data', 'rawData', 'headers', 'console', 'result', '_',
      code + '\nreturn result;'
    );
    
    const executionResult = execFunc(
      sandbox.data,
      sandbox.rawData,
      sandbox.headers,
      sandbox.console,
      sandbox.result,
      sandbox._
    );
    
    console.log('=== EXECUTION RESULT ===');
    console.log('Result:', executionResult);
    console.log('Stdout:', sandbox.stdout);
    
    return {
      ok: true,
      stdout: sandbox.stdout || 'Code executed successfully',
      result: executionResult || sandbox.result,
      dataAccess
    };
  } catch (error) {
    console.error('Execution error:', error);
    return {
      ok: false,
      stdout: '',
      result: null,
      error: error instanceof Error ? error.message : 'Execution failed',
      dataAccess
    };
  }
}