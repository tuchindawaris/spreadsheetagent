
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
