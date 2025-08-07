import * as XLSX from 'xlsx';
import { SheetModel, Table, ColumnMeta } from './types';

export function parseSheetToModel(file: File): Promise<SheetModel> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const tables: Table[] = [];
        const issues: string[] = [];
        
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length === 0) {
            issues.push(`Sheet "${sheetName}" is empty`);
            return;
          }
          
          // Extract headers from first row
          const headers = (jsonData[0] as any[]).filter(h => h !== undefined && h !== null);
          if (headers.length === 0) {
            issues.push(`Sheet "${sheetName}" has no headers`);
            return;
          }
          
          // Extract rows
          const rows = jsonData.slice(1).map((row: any) => {
            const obj: any = {};
            headers.forEach((header, idx) => {
              obj[header] = row[idx];
            });
            return obj;
          }).filter(row => Object.values(row).some(v => v !== undefined && v !== null));
          
          // Analyze columns
          const columns: ColumnMeta[] = headers.map(header => {
            const values = rows.map(r => r[header]).filter(v => v !== undefined && v !== null);
            const types = new Set(values.map(v => typeof v));
            
            let type: 'string' | 'number' | 'date' | 'mixed' = 'string';
            if (types.size === 1) {
              const singleType = Array.from(types)[0];
              if (singleType === 'number') type = 'number';
              else if (singleType === 'object' && values[0] instanceof Date) type = 'date';
            } else if (types.size > 1) {
              type = 'mixed';
            }
            
            return {
              name: String(header),
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