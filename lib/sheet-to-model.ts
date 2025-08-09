import * as XLSX from 'xlsx';
import { SheetModel, Table, ColumnMeta } from './types';

interface MergeInfo {
  s: { r: number; c: number }; // start row/col
  e: { r: number; c: number }; // end row/col
}

interface TableBoundary {
  startRow: number;
  endRow: number;
  mergeHeader?: string;
  description?: string;
}

export async function parseSheetToModel(file: File): Promise<SheetModel> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { 
          type: 'array',
          cellStyles: true,
          cellNF: true,
          cellDates: true
        });
        
        const tables: Table[] = [];
        const issues: string[] = [];
        
        // Process each sheet
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          
          // Get raw data first
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
          const merges: MergeInfo[] = worksheet['!merges'] || [];
          
          // Extract all raw data
          const rawData: any[][] = [];
          const mergeMap = new Map<string, MergeInfo>();
          
          // Build merge map
          merges.forEach(merge => {
            for (let r = merge.s.r; r <= merge.e.r; r++) {
              for (let c = merge.s.c; c <= merge.e.c; c++) {
                const cellAddr = XLSX.utils.encode_cell({ r, c });
                mergeMap.set(cellAddr, merge);
              }
            }
          });
          
          // Extract data with merge handling
          for (let r = range.s.r; r <= range.e.r; r++) {
            const row: any[] = [];
            for (let c = range.s.c; c <= range.e.c; c++) {
              const cellAddr = XLSX.utils.encode_cell({ r, c });
              const cell = worksheet[cellAddr];
              
              const mergeInfo = mergeMap.get(cellAddr);
              if (mergeInfo) {
                const masterCell = worksheet[XLSX.utils.encode_cell({ 
                  r: mergeInfo.s.r, 
                  c: mergeInfo.s.c 
                })];
                row.push(getCellValue(masterCell));
              } else {
                row.push(getCellValue(cell));
              }
            }
            rawData.push(row);
          }
          
          if (rawData.length === 0) {
            issues.push(`Sheet "${sheetName}" is empty`);
            continue;
          }
          
          // Use LLM to detect table boundaries
          const boundaries = await detectTableBoundariesWithLLM(rawData, merges);
          
          // Process each detected table
          for (let tableIndex = 0; tableIndex < boundaries.length; tableIndex++) {
            const boundary = boundaries[tableIndex];
            const tableData = rawData.slice(boundary.startRow, boundary.endRow + 1);
            const tableMerges = merges.filter(m => 
              m.s.r >= boundary.startRow && m.e.r <= boundary.endRow
            ).map(m => ({
              s: { r: m.s.r - boundary.startRow, c: m.s.c },
              e: { r: m.e.r - boundary.startRow, c: m.e.c }
            }));
            
            // Detect header rows for this table
            const headerRowCount = detectHeaderRows(tableData, tableMerges, range.e.c + 1);
            const headerRows = tableData.slice(0, headerRowCount);
            
            // Build column names with merge prefix if applicable
            const columnNames: string[] = [];
            const mergePrefix = boundary.mergeHeader ? `${boundary.mergeHeader}_` : '';
            
            for (let c = 0; c <= range.e.c; c++) {
              const pathParts: string[] = [];
              
              // Add merge header if exists
              if (boundary.mergeHeader) {
                pathParts.push(boundary.mergeHeader);
              }
              
              // Collect all header values for this column
              for (let r = 0; r < headerRowCount; r++) {
                let value: string | null = null;
                
                const merge = tableMerges.find(m => 
                  r >= m.s.r && r <= m.e.r && 
                  c >= m.s.c && c <= m.e.c
                );
                
                if (merge) {
                  value = headerRows[merge.s.r][merge.s.c];
                } else {
                  value = headerRows[r][c];
                }
                
                if (value && String(value).trim()) {
                  pathParts.push(String(value).trim());
                }
              }
              
              let colName = pathParts.join('_');
              if (!colName) {
                colName = `${mergePrefix}Column_${String.fromCharCode(65 + c)}`;
              }
              
              colName = makeUnique(colName, columnNames);
              columnNames.push(colName);
            }
            
            // Skip empty columns
            const validColumns: { name: string; index: number }[] = [];
            columnNames.forEach((name, index) => {
              // Check if column has any data
              const hasData = tableData.slice(headerRowCount).some(row => {
                const val = row[index];
                return val !== undefined && val !== null && val !== '';
              });
              
              if (name && name.trim() !== '' && hasData) {
                validColumns.push({ name, index });
              }
            });
            
            if (validColumns.length === 0) {
              issues.push(`Table ${tableIndex + 1} in sheet "${sheetName}" has no valid columns`);
              continue;
            }
            
            // Extract data rows
            const rows = tableData.slice(headerRowCount).map(rowData => {
              const obj: any = {};
              validColumns.forEach(col => {
                const value = rowData[col.index];
                obj[col.name] = value;
              });
              return obj;
            }).filter(row => {
              return Object.values(row).some(v => v !== undefined && v !== null && v !== '');
            });
            
            // Skip empty tables
            if (rows.length === 0) {
              continue;
            }
            
            // Analyze columns
            const columns: ColumnMeta[] = validColumns.map(col => {
              const values = rows.map(r => r[col.name])
                .filter(v => v !== undefined && v !== null && v !== '');
              
              const types = new Set(values.map(v => {
                if (v instanceof Date) return 'date';
                if (typeof v === 'number') return 'number';
                return 'string';
              }));
              
              let type: 'string' | 'number' | 'date' | 'mixed' = 'string';
              if (types.size === 1) {
                type = Array.from(types)[0] as any;
              } else if (types.size > 1) {
                type = 'mixed';
              }
              
              return {
                name: col.name,
                type,
                sample: values[0] || null
              };
            });
            
            // Generate table name
            let tableName = sheetName;
            if (boundaries.length > 1) {
              if (boundary.mergeHeader) {
                tableName = `${sheetName}_${boundary.mergeHeader.replace(/[^\w]/g, '_')}`;
              } else if (boundary.description) {
                tableName = `${sheetName}_${boundary.description.replace(/[^\w]/g, '_')}`;
              } else {
                tableName = `${sheetName}_Table${tableIndex + 1}`;
              }
            }
            
            tables.push({
              name: tableName,
              rows,
              columns
            });
          }
        }
        
        // Check for 20k cell limit
        const totalCells = tables.reduce((sum, table) => 
          sum + (table.rows.length * table.columns.length), 0
        );
        
        if (totalCells > 20000) {
          reject(new Error('File exceeds 20,000 cell limit'));
          return;
        }
        
        resolve({ tables, issues });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

async function detectTableBoundariesWithLLM(
  rawData: any[][], 
  merges: MergeInfo[]
): Promise<TableBoundary[]> {
  // Prepare data samples for LLM
  const samples: Array<{ rowIndex: number; data: any[]; hasMerge: boolean }> = [];
  
  // Always include first 5 rows
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    samples.push({
      rowIndex: i,
      data: rawData[i],
      hasMerge: merges.some(m => m.s.r === i)
    });
  }
  
  // Find potential boundaries (empty rows, merged cells, type changes)
  for (let i = 5; i < rawData.length; i++) {
    const row = rawData[i];
    const prevRow = rawData[i - 1];
    const hasMerge = merges.some(m => m.s.r === i);
    
    // Check for empty rows
    const isEmpty = row.every(cell => 
      cell === null || cell === undefined || cell === '' || 
      (typeof cell === 'string' && cell.trim() === '')
    );
    
    const prevIsEmpty = i > 0 && prevRow.every(cell => 
      cell === null || cell === undefined || cell === '' || 
      (typeof cell === 'string' && cell.trim() === '')
    );
    
    // Include this row if it's interesting
    if (hasMerge || (isEmpty && !prevIsEmpty) || (!isEmpty && prevIsEmpty)) {
      // Include context (2 rows before and after)
      for (let j = Math.max(0, i - 2); j <= Math.min(rawData.length - 1, i + 2); j++) {
        if (!samples.some(s => s.rowIndex === j)) {
          samples.push({
            rowIndex: j,
            data: rawData[j],
            hasMerge: merges.some(m => m.s.r === j)
          });
        }
      }
    }
  }
  
  // Sort samples by row index
  samples.sort((a, b) => a.rowIndex - b.rowIndex);
  
  try {
    // Call server API for LLM detection
    const response = await fetch('/api/detect-tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        samples,
        totalRows: rawData.length
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      throw new Error('Failed to detect tables');
    }
    
    const result = await response.json();
    
    if (!result.boundaries || !Array.isArray(result.boundaries)) {
      console.error('Invalid API response:', result);
      throw new Error('Invalid boundaries in response');
    }
    
    return result.boundaries;
    
  } catch (error) {
    console.error('LLM table detection failed, falling back to simple approach:', error);
    
    // Fallback: detect based on merged cells only
    const boundaries: TableBoundary[] = [];
    let currentStart = 0;
    
    for (let r = 0; r < rawData.length; r++) {
      const rowHasMerge = merges.some(m => m.s.r === r && r > currentStart);
      
      if (rowHasMerge) {
        // End current table before this merge
        if (r > currentStart) {
          boundaries.push({
            startRow: currentStart,
            endRow: r - 1
          });
        }
        
        // Get merge value
        const merge = merges.find(m => m.s.r === r);
        const mergeValue = merge ? rawData[r][merge.s.c] : null;
        
        // The next table will start after this merge
        currentStart = r + 1;
      }
    }
    
    // Add final boundary
    if (currentStart < rawData.length) {
      boundaries.push({
        startRow: currentStart,
        endRow: rawData.length - 1
      });
    }
    
    // If no boundaries found, treat as single table
    if (boundaries.length === 0) {
      boundaries.push({
        startRow: 0,
        endRow: rawData.length - 1
      });
    }
    
    return boundaries;
  }
}

function detectHeaderRows(
  rawData: any[][], 
  merges: MergeInfo[],
  columnCount: number
): number {
  let headerRowCount = 1;
  
  for (let r = 0; r < Math.min(rawData.length, 10); r++) {
    const row = rawData[r];
    
    const hasRowMerges = merges.some(merge => 
      merge.s.r <= r && merge.e.r >= r
    );
    
    if (!hasRowMerges) {
      const nonEmptyCount = row.filter(cell => 
        cell !== null && cell !== undefined && cell !== ''
      ).length;
      
      if (nonEmptyCount > columnCount * 0.5) {
        headerRowCount = r;
        break;
      }
    }
  }
  
  return Math.max(1, headerRowCount);
}

function getCellValue(cell: any): any {
  if (!cell) return null;
  
  if (cell.t === 'n') return cell.v;
  if (cell.t === 's') return cell.v;
  if (cell.t === 'b') return cell.v;
  if (cell.t === 'd') return cell.v;
  
  if (cell.w !== undefined) return cell.w;
  if (cell.v !== undefined) return cell.v;
  
  return null;
}

function makeUnique(name: string, existingNames: string[]): string {
  let cleanName = name.replace(/[\s\n\r\t]+/g, '_').replace(/[^\w_ก-๙]/g, '');
  
  if (!/^[a-zA-Z_ก-๙]/.test(cleanName)) {
    cleanName = '_' + cleanName;
  }
  
  let finalName = cleanName;
  let counter = 1;
  
  while (existingNames.includes(finalName)) {
    finalName = `${cleanName}_${counter}`;
    counter++;
  }
  
  return finalName;
}