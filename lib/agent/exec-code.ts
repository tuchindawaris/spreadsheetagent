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
    
    // Clean headers - remove whitespace and handle empty headers
    const headers = firstRow.map((h, i) => {
      if (h === null || h === undefined || h === '') {
        return `Col${i + 1}`;
      }
      // Convert to string and trim whitespace
      return String(h).trim();
    });
    
    console.log('Headers detected:', headers);
    console.log('Raw first row (headers):', firstRow);
    
    // Log first few rows to debug data structure
    console.log('First 3 raw data rows:');
    for (let i = 0; i < Math.min(3, region.data.length); i++) {
      console.log(`Row ${i}:`, region.data[i]);
    }
    
    const dataRows = region.data.slice(region.headerRows).map((row, rowIndex) => {
      const obj: any = {};
      if (Array.isArray(row)) {
        headers.forEach((header, colIndex) => {
          // Store the value, preserving nulls
          obj[header] = row[colIndex];
          
          // Track access
          dataAccess.accessedRows.add(rowIndex + region.headerRows);
          dataAccess.accessedColumns.add(colIndex);
          dataAccess.accessedCells.push({ 
            row: rowIndex + region.headerRows, 
            col: colIndex 
          });
        });
      }
      return obj;
    });
    
    console.log('Sample data row:', dataRows[0]);
    console.log('Sample values from first 5 rows:');
    dataRows.slice(0, 5).forEach((row, i) => {
      console.log(`Row ${i}:`, JSON.stringify(row).slice(0, 200));
    });
    
    // Log column keys to debug
    if (dataRows.length > 0) {
      console.log('Available columns:', Object.keys(dataRows[0]));
      console.log('First row values by column:');
      Object.entries(dataRows[0]).forEach(([key, value]) => {
        console.log(`  "${key}": ${typeof value} = ${JSON.stringify(value)}`);
      });
    }
    
    // Helper function to find column by partial match
    const findColumn = (row: any, possibleNames: string[]) => {
      const keys = Object.keys(row);
      for (const name of possibleNames) {
        // Try exact match first
        if (row.hasOwnProperty(name)) return name;
        // Try case-insensitive match
        const found = keys.find(k => k.toLowerCase() === name.toLowerCase());
        if (found) return found;
        // Try partial match
        const partial = keys.find(k => k.toLowerCase().includes(name.toLowerCase()));
        if (partial) return partial;
      }
      return null;
    };
    
    // Create execution context
    let stdout = '';
    
    // Create lodash-like utilities in local scope
    const lodashUtils = {
      groupBy: (arr: any[], key: string) => {
        return arr.reduce((groups, item) => {
          const group = item[key];
          if (!groups[group]) groups[group] = [];
          groups[group].push(item);
          return groups;
        }, {});
      },
      sumBy: (arr: any[], key: string) => {
        return arr.reduce((sum, item) => {
          const val = item[key];
          // Handle various number formats
          if (val === null || val === undefined) return sum;
          if (typeof val === 'number') return sum + val;
          if (typeof val === 'string') {
            // Handle empty strings
            const trimmed = val.trim();
            if (trimmed === '') return sum;
            // Remove currency symbols, commas, and spaces
            const cleaned = trimmed.replace(/[฿$,\s]/g, '');
            const num = parseFloat(cleaned);
            if (!isNaN(num)) {
              return sum + num;
            }
          }
          return sum;
        }, 0);
      },
      sortBy: (arr: any[], key: string) => {
        return [...arr].sort((a, b) => {
          const aVal = a[key];
          const bVal = b[key];
          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
          return 0;
        });
      },
      uniqBy: (arr: any[], key: string) => {
        const seen = new Set();
        return arr.filter(item => {
          const val = item[key];
          if (seen.has(val)) return false;
          seen.add(val);
          return true;
        });
      },
      countBy: (arr: any[], key: string) => {
        return arr.reduce((counts, item) => {
          const val = item[key];
          counts[val] = (counts[val] || 0) + 1;
          return counts;
        }, {});
      },
      mapValues: (obj: any, fn: (value: any, key: string) => any) => {
        const result: any = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            result[key] = fn(obj[key], key);
          }
        }
        return result;
      },
      sum: (arr: number[]) => {
        return arr.reduce((total, num) => total + num, 0);
      },
      map: (arr: any[], fn: (item: any, index: number) => any) => {
        return arr.map(fn);
      },
      filter: (arr: any[], fn: (item: any, index: number) => boolean) => {
        return arr.filter(fn);
      }
    };
    
    // Create a console object for logging
    const consoleObj = {
      log: (...args: any[]) => {
        stdout += args.map(a => 
          typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
        ).join(' ') + '\n';
      }
    };
    
    // Create the execution function with proper scoping
    // Don't pass 'result' as parameter since we want it to be assignable
    const execFunc = new Function(
      'data', 'rawData', 'headers', 'console', '_', 'findColumn',
      `
      // User code
      ${code}
      
      // Return the result
      return typeof result !== 'undefined' ? result : null;
      `
    );
    
    // Execute the code
    const executionResult = execFunc(
      dataRows,
      region.data,
      headers,
      consoleObj,
      lodashUtils,
      findColumn
    );
    
    console.log('=== EXECUTION RESULT ===');
    console.log('Result type:', typeof executionResult);
    console.log('Result preview:', JSON.stringify(executionResult).slice(0, 200));
    console.log('Stdout:', stdout);
    
    return {
      ok: true,
      stdout: stdout || 'Code executed successfully',
      result: executionResult,
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