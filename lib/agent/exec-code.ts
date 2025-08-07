import { RegionSelection } from './select-region';

export interface ExecResult {
  ok: boolean;
  stdout: string;
  result: any;
  error?: string;
}

export async function executeCode(
  code: string,
  region: RegionSelection
): Promise<ExecResult> {
  console.log('=== EXECUTING CODE ===');
  console.log('Code to execute:', code);
  console.log('Available columns:', region.table.columns.map(c => c.name));
  console.log('First 3 rows of data:', region.table.rows.slice(0, 3));
  console.log('===================');
  
  try {
    // Create execution context with data and utilities
    const sandbox = {
      data: region.table.rows,
      result: null,
      console: {
        log: (...args: any[]) => {
          sandbox.stdout += args.map(a => {
            if (typeof a === 'object') {
              // For arrays, show a preview if it's long
              if (Array.isArray(a) && a.length > 10) {
                const preview = a.slice(0, 5);
                return `[${preview.map(item => JSON.stringify(item)).join(', ')}, ... (${a.length} total items)]`;
              }
              return JSON.stringify(a, null, 2);
            }
            return String(a);
          }).join(' ') + '\n';
        }
      },
      stdout: '',
      // Add lodash utilities
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
        meanBy: (arr: any[], key: string) => {
          const sum = arr.reduce((s, item) => s + (Number(item[key]) || 0), 0);
          return arr.length > 0 ? sum / arr.length : 0;
        },
        maxBy: (arr: any[], key: string) => {
          return arr.reduce((max, item) => 
            (item[key] > max[key] ? item : max), arr[0] || null);
        },
        minBy: (arr: any[], key: string) => {
          return arr.reduce((min, item) => 
            (item[key] < min[key] ? item : min), arr[0] || null);
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
      throw new Error(`Code execution failed: ${funcError instanceof Error ? funcError.message : 'Unknown error'}`);
    }
    
    console.log('=== EXECUTION RESULT ===');
    console.log('Stdout:', sandbox.stdout);
    console.log('Result:', executionResult);
    console.log('===================');
    
    return {
      ok: true,
      stdout: sandbox.stdout || 'Code executed successfully',
      result: executionResult !== null ? executionResult : sandbox.result
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
      error: error instanceof Error ? error.message : 'Execution failed'
    };
  }
}