import { DataAccessInfo, Table } from '../types';

export interface HighlightRange {
  sheetId: string;
  range: string;
  description: string;
}

export function calculateHighlightRanges(
  dataAccess: DataAccessInfo,
  table: Table,
  sheetId: string
): HighlightRange[] {
  const ranges: HighlightRange[] = [];
  
  if (dataAccess.accessedColumns.size === 0) {
    return ranges;
  }
  
  // Get column indices for accessed columns
  const columnIndices = new Map<string, number>();
  table.columns.forEach((col, idx) => {
    columnIndices.set(col.name, idx);
  });
  
  const accessedColumnIndices = Array.from(dataAccess.accessedColumns)
    .map(colName => columnIndices.get(colName))
    .filter(idx => idx !== undefined) as number[];
  
  if (accessedColumnIndices.length === 0) {
    return ranges;
  }
  
  // Sort for easier range calculation
  accessedColumnIndices.sort((a, b) => a - b);
  const accessedRowIndices = Array.from(dataAccess.accessedRows).sort((a, b) => a - b);
  
  // Calculate if we're accessing all rows or specific ones
  const allRows = accessedRowIndices.length === table.rows.length;
  
  if (allRows || accessedRowIndices.length > table.rows.length * 0.8) {
    // Highlight entire columns if accessing all or most rows
    accessedColumnIndices.forEach(colIdx => {
      const colLetter = String.fromCharCode(65 + colIdx);
      const endRow = table.rows.length + 1; // +1 for header
      ranges.push({
        sheetId,
        range: `${colLetter}1:${colLetter}${endRow}`,
        description: `Column ${table.columns[colIdx].name}`
      });
    });
  } else if (accessedRowIndices.length > 0) {
    // Highlight specific cell ranges if accessing specific rows
    const minCol = Math.min(...accessedColumnIndices);
    const maxCol = Math.max(...accessedColumnIndices);
    const minRow = Math.min(...accessedRowIndices) + 2; // +2 because Excel is 1-indexed and we have header
    const maxRow = Math.max(...accessedRowIndices) + 2;
    
    const startColLetter = String.fromCharCode(65 + minCol);
    const endColLetter = String.fromCharCode(65 + maxCol);
    
    ranges.push({
      sheetId,
      range: `${startColLetter}${minRow}:${endColLetter}${maxRow}`,
      description: `${accessedRowIndices.length} rows across ${accessedColumnIndices.length} columns`
    });
  }
  
  return ranges;
}