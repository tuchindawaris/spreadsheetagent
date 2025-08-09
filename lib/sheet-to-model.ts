import * as XLSX from 'xlsx';
import { SheetModel, Table, ColumnMeta } from './types';

export function parseSheetToModel(file: File): Promise<SheetModel> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
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
        
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          
          // Handle merged cells BEFORE converting to JSON
          if (worksheet['!merges']) {
            worksheet['!merges'].forEach(merge => {
              // Get the value from the top-left cell of the merged range
              const startCell = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
              const masterValue = worksheet[startCell];
              
              // Fill all cells in the merged range with the master cell's value
              for (let row = merge.s.r; row <= merge.e.r; row++) {
                for (let col = merge.s.c; col <= merge.e.c; col++) {
                  const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
                  // Copy the entire cell object to preserve formatting, type, etc.
                  if (masterValue) {
                    worksheet[cellAddr] = { ...masterValue };
                  }
                }
              }
            });
            
            // Remove the merges array so sheet_to_json treats all cells as normal
            delete worksheet['!merges'];
          }
          
          // Now convert to JSON - all cells will have values
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            raw: false, // Get formatted strings
            defval: null // Use null for empty cells
          });
          
          if (jsonData.length === 0) {
            issues.push(`Sheet "${sheetName}" is empty`);
            return;
          }
          
          // Extract headers from first row
          const headers = (jsonData[0] as any[])
            .filter(h => h !== undefined && h !== null && h !== '')
            .map(h => String(h).trim());
            
          if (headers.length === 0) {
            issues.push(`Sheet "${sheetName}" has no headers`);
            return;
          }
          
          // Extract rows
          const rows = jsonData.slice(1).map((row: any) => {
            const obj: any = {};
            headers.forEach((header, idx) => {
              // Handle the value - could be string, number, date, etc.
              let value = row[idx];
              
              // Convert Excel dates if needed
              if (value && typeof value === 'number' && value > 40000 && value < 50000) {
                // Likely an Excel date serial number
                const date = XLSX.SSF.parse_date_code(value);
                if (date) {
                  value = new Date(date.y, date.m - 1, date.d);
                }
              }
              
              obj[header] = value;
            });
            return obj;
          }).filter(row => {
            // Keep rows that have at least one non-empty value
            return Object.values(row).some(v => v !== undefined && v !== null && v !== '');
          });
          
          // Analyze columns
          const columns: ColumnMeta[] = headers.map(header => {
            const values = rows.map(r => r[header]).filter(v => v !== undefined && v !== null && v !== '');
            const types = new Set(values.map(v => {
              if (v instanceof Date) return 'date';
              if (typeof v === 'number') return 'number';
              return 'string';
            }));
            
            let type: 'string' | 'number' | 'date' | 'mixed' = 'string';
            if (types.size === 1) {
              const singleType = Array.from(types)[0];
              type = singleType as any;
            } else if (types.size > 1) {
              type = 'mixed';
            }
            
            return {
              name: header,
              type,
              sample: values[0] || null
            };
          });
          
          tables.push({
            name: sheetName,
            rows,
            columns
          });
        });
        
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