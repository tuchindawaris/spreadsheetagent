
// lib/agent/calculate-ranges.ts - Simplified version
import { DataAccessInfo } from '../types';

export interface HighlightRange {
  sheetId: string;
  range: string;
  description: string;
}

export function calculateHighlightRanges(
  dataAccess: DataAccessInfo,
  sheetName: string
): HighlightRange[] {
  if (!dataAccess || dataAccess.accessedCells.length === 0) {
    return [];
  }
  
  const rows = Array.from(dataAccess.accessedRows).sort((a, b) => a - b);
  const cols = Array.from(dataAccess.accessedColumns).sort((a, b) => a - b);
  
  if (rows.length === 0 || cols.length === 0) return [];
  
  const colToLetter = (col: number) => {
    let letter = '';
    let temp = col;
    while (temp >= 0) {
      letter = String.fromCharCode(65 + (temp % 26)) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };
  
  // Create a single range encompassing all accessed cells
  const startCol = colToLetter(Math.min(...cols));
  const endCol = colToLetter(Math.max(...cols));
  const startRow = Math.min(...rows) + 1;
  const endRow = Math.max(...rows) + 1;
  
  return [{
    sheetId: sheetName,
    range: `${startCol}${startRow}:${endCol}${endRow}`,
    description: `${rows.length} rows × ${cols.length} columns`
  }];
}