import { RegionSelection } from './select-region';
import { DataAccessInfo, ExecResultWithAccess } from '../types';

export interface ExecResult extends ExecResultWithAccess {}

export async function executeCode(
  code: string,
  region: RegionSelection
): Promise<ExecResult> {
  console.log('=== EXECUTING CODE ===');
  console.log('Code to execute:', code);
  console.log('Available columns:', region.table.columns.map(c => c.name));
  console.log('Data shape:', {
    rows: region.table.rows.length,
    columns: region.table.columns.length,
    firstRowKeys: Object.keys(region.table.rows[0] || {})
  });
  console.log('First 3 rows of data:', region.table.rows.slice(0, 3));
  console.log('===================');
  
  // Initialize data access tracking
  const dataAccess: DataAccessInfo = {
    accessedRows: new Set(),
    accessedColumns: new Set(),
    accessedCells: []
  };
  
  try {
    // Create a proxy for each data row to track property access
    const trackedData = region.table.rows.map((row, rowIndex) => {
      return new Proxy(row, {
        get(target, prop) {
          // Track column access
          if (typeof prop === 'string' && prop in target) {
            dataAccess.accessedColumns.add(prop);
            dataAccess.accessedRows.add(rowIndex);
            dataAccess.accessedCells.push({ row: rowIndex, column: prop });
          }
          return target[prop];
        }
      });
    });
    
    // Create execution context with tracked data
    const sandbox = {
      data: trackedData,
      result: null,
      console: {
        log: (...args: any[]) => {
          const logLine = args.map(a => {
            if (typeof a === 'object') {
              // For arrays, show a preview if it's long
              if (Array.isArray(a)) {
                if (a.length === 0) {
                  return '[]';
                } else if (a.length > 10) {
                  const preview = a.slice(0, 5);
                  const previewStr = preview.map(item => 
                    typeof item === 'string' ? `"${item}"` : JSON.stringify(item)
                  ).join(', ');
                  return `[${previewStr}, ... (${a.length} total items)]`;
                } else {
                  return JSON.stringify(a);
                }
              }
              // For objects, pretty print
              return JSON.stringify(a, null, 2);
            }
            return String(a);
          }).join(' ');
          
          sandbox.stdout += logLine + '\n';
        }
      },
      stdout: '',
      // Add lodash utilities
      _: {
        groupBy: (arr: any[], key: string) => {
          // Track column access when using lodash
          if (arr === trackedData && key) {
            dataAccess.accessedColumns.add(key);
          }
          return arr.reduce((groups, item) => {
            const group = item[key];
            if (!groups[group]) groups[group] = [];
            groups[group].push(item);
            return groups;
          }, {});
        },
        sumBy: (arr: any[], key: string) => {
          if (arr === trackedData && key) {
            dataAccess.accessedColumns.add(key);
          }
          return arr.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
        },
        sortBy: (arr: any[], key: string) => {
          if (arr === trackedData && key) {
            dataAccess.accessedColumns.add(key);
          }
          return [...arr].sort((a, b) => {
            if (a[key] < b[key]) return -1;
            if (a[key] > b[key]) return 1;
            return 0;
          });
        },
        uniqBy: (arr: any[], key: string) => {
          if (arr === trackedData && key) {
            dataAccess.accessedColumns.add(key);
          }
          const seen = new Set();
          return arr.filter(item => {
            const val = item[key];
            if (seen.has(val)) return false;
            seen.add(val);
            return true;
          });
        },
        meanBy: (arr: any[], key: string) => {
          if (arr === trackedData && key) {
            dataAccess.accessedColumns.add(key);
          }
          const sum = arr.reduce((s, item) => s + (Number(item[key]) || 0), 0);
          return arr.length > 0 ? sum / arr.length : 0;
        },
        maxBy: (arr: any[], key: string) => {
          if (arr === trackedData && key) {
            dataAccess.accessedColumns.add(key);
          }
          return arr.reduce((max, item) => 
            (item[key] > max[key] ? item : max), arr[0] || null);
        },
        minBy: (arr: any[], key: string) => {
          if (arr === trackedData && key) {
            dataAccess.accessedColumns.add(key);
          }
          return arr.reduce((min, item) => 
            (item[key] < min[key] ? item : min), arr[0] || null);
        },
        countBy: (arr: any[], key: string) => {
          if (arr === trackedData && key) {
            dataAccess.accessedColumns.add(key);
          }
          return arr.reduce((counts, item) => {
            const val = item[key];
            counts[val] = (counts[val] || 0) + 1;
            return counts;
          }, {});
        },
        flatten: (arr: any[]) => {
          return arr.reduce((flat, item) => 
            flat.concat(Array.isArray(item) ? item : [item]), []);
        }
      }
    };
    
    // Execute the code in a controlled environment
    const execFunc = new Function(
      'data', 'console', 'result', '_',
      code + '\nreturn result;'
    );
    
    let executionResult = sandbox.result;
    try {
      executionResult = execFunc(
        sandbox.data, 
        sandbox.console, 
        sandbox.result,
        sandbox._
      );
    } catch (funcError) {
      // If the function itself throws, re-throw with clearer message
      const errorMsg = funcError instanceof Error ? funcError.message : 'Unknown error';
      console.error('Function execution error:', errorMsg);
      
      // Try to extract useful info from error
      if (errorMsg.includes('Cannot read properties of undefined')) {
        const match = errorMsg.match(/reading '([^']+)'/);
        if (match) {
          throw new Error(`Code tried to access property '${match[1]}' on undefined value - check if column exists and has data`);
        }
      }
      
      throw new Error(`Code execution failed: ${errorMsg}`);
    }
    
    console.log('=== EXECUTION RESULT ===');
    console.log('Stdout:', sandbox.stdout || '(no console output)');
    console.log('Result type:', Array.isArray(executionResult) ? 'array' : typeof executionResult);
    if (Array.isArray(executionResult)) {
      console.log('Result length:', executionResult.length);
      console.log('First few items:', executionResult.slice(0, 3));
    } else {
      console.log('Result:', executionResult);
    }
    console.log('=== DATA ACCESS INFO ===');
    console.log('Accessed columns:', Array.from(dataAccess.accessedColumns));
    console.log('Accessed rows:', dataAccess.accessedRows.size, 'rows');
    console.log('Total cell accesses:', dataAccess.accessedCells.length);
    console.log('===================');
    
    return {
      ok: true,
      stdout: sandbox.stdout || 'Code executed successfully',
      result: executionResult !== null ? executionResult : sandbox.result,
      dataAccess
    };
  } catch (error) {
    console.error('=== EXECUTION ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('===================');
    
    return {
      ok: false,
      stdout: '',
      result: null,
      error: error instanceof Error ? error.message : 'Execution failed',
      dataAccess
    };
  }
}