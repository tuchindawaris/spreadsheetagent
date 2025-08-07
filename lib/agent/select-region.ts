import { Frame, SheetModel } from '../types';

export interface RegionSelection {
  sheetId: string;
  range: string;
  table: any;
}

export function selectRegion(
  frame: Frame,
  sheetModel: SheetModel
): RegionSelection {
  // Heuristic: find first table containing all needed columns
  for (const table of sheetModel.tables) {
    const columnNames = table.columns.map(c => c.name.toLowerCase());
    const hasAllColumns = frame.neededColumns.every(needed =>
      columnNames.some(col => col.includes(needed.toLowerCase()))
    );
    
    if (hasAllColumns || frame.neededColumns.length === 0) {
      // Calculate range (e.g., "A1:E10")
      const endCol = String.fromCharCode(65 + table.columns.length - 1);
      const endRow = table.rows.length + 1; // +1 for header
      const range = `A1:${endCol}${endRow}`;
      
      return {
        sheetId: table.name,
        range,
        table
      };
    }
  }
  
  // Fallback: return first table
  const firstTable = sheetModel.tables[0];
  const endCol = String.fromCharCode(65 + firstTable.columns.length - 1);
  const endRow = firstTable.rows.length + 1;
  
  return {
    sheetId: firstTable.name,
    range: `A1:${endCol}${endRow}`,
    table: firstTable
  };
}