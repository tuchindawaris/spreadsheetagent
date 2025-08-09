
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