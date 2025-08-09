// lib/sheet-to-model.ts
import * as XLSX from 'xlsx';
import { SheetModel, Sheet } from './types';

export async function parseSheetToModel(file: File): Promise<SheetModel> {
  console.log('parseSheetToModel called with file:', file.name, 'size:', file.size);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        console.log('Starting to parse spreadsheet file...');
        
        if (!e.target?.result) {
          throw new Error('Failed to read file content');
        }
        
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        console.log('Read ArrayBuffer, size:', data.byteLength);
        
        console.log('Reading workbook with XLSX...');
        const workbook = XLSX.read(data, { 
          type: 'array',
          cellDates: true,
          cellStyles: true,
          cellNF: true,
          sheetStubs: true  // Include empty cells
        });
        
        console.log(`Found ${workbook.SheetNames.length} sheets:`, workbook.SheetNames);
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('No sheets found in the Excel file');
        }
        
        const sheets: Sheet[] = [];
        let totalCells = 0;
        
        // Process each sheet
        for (const sheetName of workbook.SheetNames) {
          try {
            const worksheet = workbook.Sheets[sheetName];
            
            // Get the range - handle empty sheets
            if (!worksheet['!ref']) {
              console.warn(`Sheet "${sheetName}" appears to be empty`);
              continue;
            }
          
          const range = XLSX.utils.decode_range(worksheet['!ref']);
          const rows = range.e.r + 1;
          const cols = range.e.c + 1;
          
          // Validate dimensions
          if (rows === 0 || cols === 0) {
            console.warn(`Sheet "${sheetName}" has invalid dimensions: ${rows}x${cols}`);
            continue;
          }
          
          // Extract all data as a 2D array
          const data: any[][] = [];
          for (let r = 0; r <= range.e.r; r++) {
            const row: any[] = [];
            for (let c = 0; c <= range.e.c; c++) {
              const cellAddr = XLSX.utils.encode_cell({ r, c });
              const cell = worksheet[cellAddr];
              // Handle different cell types and formats
              if (cell) {
                // For date cells, XLSX should have already converted them with cellDates: true
                // Otherwise use formatted value if available, otherwise raw value
                row.push(cell.w !== undefined ? cell.w : cell.v);
              } else {
                row.push(null);
              }
            }
            data.push(row);
          }
          
          // Skip completely empty sheets
          if (data.length === 0) {
            console.warn(`Sheet "${sheetName}" has no rows`);
            continue;
          }
          
          // Validate data structure
          const hasValidData = data.some(row => 
            Array.isArray(row) && row.some(cell => cell != null)
          );
          
          if (!hasValidData) {
            console.warn(`Sheet "${sheetName}" has no valid data`);
            continue;
          }
          
          console.log(`Sheet "${sheetName}": ${rows} rows × ${cols} columns, first row:`, data[0]?.slice(0, 5));
          
          totalCells += rows * cols;
          
          sheets.push({
            name: sheetName,
            data,
            merges: worksheet['!merges'] || [],
            dimensions: { rows, cols }
          });
          
          console.log(`Added sheet "${sheetName}" with ${rows} rows × ${cols} columns`);
          } catch (sheetError) {
            console.error(`Error processing sheet "${sheetName}":`, sheetError);
            // Continue with other sheets
          }
        }
        
        // Check if we have any valid sheets
        if (sheets.length === 0) {
          reject(new Error('No valid data found in the spreadsheet'));
          return;
        }
        
        // Check for 20k cell limit
        if (totalCells > 20000) {
          reject(new Error(`File exceeds 20,000 cell limit (has ${totalCells} cells)`));
          return;
        }
        
        resolve({ sheets });
      } catch (error) {
        console.error('Error parsing spreadsheet:', error);
        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new Error('Unknown error while parsing spreadsheet'));
        }
      }
    };
    
    reader.onerror = (error) => {
      console.error('File reader error:', error);
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

// lib/types.ts - Simplified types
export interface Sheet {
  name: string;
  data: any[][];  // Raw 2D array of cell values
  merges: Array<{
    s: { r: number; c: number }; // start row/col
    e: { r: number; c: number }; // end row/col
  }>;
  dimensions: {
    rows: number;
    cols: number;
  };
}

export interface SheetModel {
  sheets: Sheet[];
}

export interface RetryContext {
  previousAttempts: {
    code: string;
    error?: string;
    result?: any;
    stdout: string;
  }[];
  failureReason: string;
  gptFeedback?: string;
}
export interface Frame {
  intent: string;
  summary: string;
  targetSheet?: string;
  dataRange?: { startRow: number; endRow: number; startCol: number; endCol: number };
}

export type AgentEvent =
  | { type: 'connected' }
  | { type: 'highlight'; sheetId: string; range: string }
  | { type: 'thought'; message: string }
  | { type: 'answer'; content: AnswerPayload };

export interface AnswerPayload {
  markdown: string;
  data?: any;
  analysisContext?: {
    accessedRange?: string;
    intent: string;
    operation?: string;
  };
}

export interface AgentContext {
  sessionId: string;
  prompt: string;
  sheetModel: SheetModel;
  maxRetries: number;
  maxGptCalls: number;
  gptCallCount: number;
}

export interface DataAccessInfo {
  accessedRows: Set<number>;
  accessedColumns: Set<number>;
  accessedCells: Array<{ row: number; col: number }>;
}

// Export all types
export type { Sheet, SheetModel, Frame, AgentEvent, AnswerPayload, AgentContext, RetryContext, DataAccessInfo, ExecResult };