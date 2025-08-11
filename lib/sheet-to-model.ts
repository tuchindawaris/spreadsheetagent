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
        
        // Process each sheet
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          
          // Handle merged cells if they exist
          if (worksheet['!merges']) {
            for (const merge of worksheet['!merges']) {
              // Get the first cell in the merge range (top-left)
              const firstCellAddr = XLSX.utils.encode_cell({ 
                r: merge.s.r, 
                c: merge.s.c 
              });
              const firstCell = worksheet[firstCellAddr];
              
              // If the first cell has a value, copy it to all cells in the merge range
              if (firstCell) {
                for (let row = merge.s.r; row <= merge.e.r; row++) {
                  for (let col = merge.s.c; col <= merge.e.c; col++) {
                    const addr = XLSX.utils.encode_cell({ r: row, c: col });
                    worksheet[addr] = firstCell;
                  }
                }
              }
            }
            // Remove merge info after processing
            delete worksheet['!merges'];
          }
          
          // Get the range of the worksheet
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
          
          // Extract all data as array of arrays
          const data: any[][] = [];
          for (let row = range.s.r; row <= range.e.r; row++) {
            const rowData: any[] = [];
            for (let col = range.s.c; col <= range.e.c; col++) {
              const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
              const cell = worksheet[cellAddr];
              
              if (cell) {
                // Use the formatted value if available, otherwise raw value
                rowData.push(cell.w || cell.v);
              } else {
                rowData.push('');
              }
            }
            data.push(rowData);
          }
          
          if (data.length === 0) {
            issues.push(`Sheet "${sheetName}" is empty`);
            continue;
          }
          
          // First row contains headers
          const headers = data[0];
          const columns: ColumnMeta[] = headers.map((header, idx) => ({
            name: header || `Column${idx + 1}`,
            type: 'string',
            sample: null
          }));
          
          // Convert remaining rows to objects
          const rows: any[] = [];
          for (let i = 1; i < data.length; i++) {
            const row: any = {};
            let hasData = false;
            
            for (let j = 0; j < columns.length; j++) {
              const value = i < data.length && j < data[i].length ? data[i][j] : '';
              row[columns[j].name] = value;
              if (value !== '') hasData = true;
            }
            
            // Include all rows, even if empty
            rows.push(row);
          }
          
          // Analyze column types from actual data
          for (const col of columns) {
            const values = rows
              .map(row => row[col.name])
              .filter(v => v !== '');
            
            if (values.length > 0) {
              col.sample = values[0];
              
              // Simple type detection
              const isAllNumbers = values.every(v => !isNaN(Number(v)));
              if (isAllNumbers) {
                col.type = 'number';
              }
            }
          }
          
          tables.push({
            name: sheetName,
            rows,
            columns
          });
        }
        
        // Check total cell count
        const totalCells = tables.reduce((sum, table) => 
          sum + (table.rows.length * table.columns.length), 0
        );
        
        if (totalCells > 20000) {
          reject(new Error('File exceeds 20,000 cell limit'));
          return;
        }
        
        resolve({ tables, issues });
        
      } catch (error) {
        reject(new Error(`Failed to parse file: ${error}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}