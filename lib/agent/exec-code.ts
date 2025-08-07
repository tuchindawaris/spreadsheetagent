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
  
  // MVP: Simple JavaScript execution instead of Python
  // In production, use a proper sandboxed Python environment
  
  try {
    // Convert table data to a format we can work with
    const data = region.table.rows;
    
    // Create a safe execution context
    const sandbox = {
      data,
      result: null,
      console: {
        log: (...args: any[]) => {
          sandbox.stdout += args.map(a => String(a)).join(' ') + '\n';
        }
      },
      stdout: ''
    };
    
    // Transform Python-like code to JavaScript (very basic)
    console.log('=== TRANSFORMING PYTHON TO JS ===');
    let jsCode = code
      .replace(/import pandas as pd/g, '// pandas import')
      .replace(/import numpy as np/g, '// numpy import')
      .replace(/df\s*=\s*pd\.DataFrame/g, 'const df = ')
      .replace(/df\[['"](\w+)['"]\]/g, 'data.map(row => row["$1"])')
      .replace(/df\.(\w+)/g, 'data.$1')
      .replace(/print\(/g, 'console.log(')
      .replace(/len\(/g, '(')
      .replace(/\)\.length/g, ').length')
      .replace(/\.tolist\(\)/g, '')
      .replace(/\.values/g, '');
    
    console.log('Transformed code:', jsCode);
    console.log('===================');
    
    // Execute in a try-catch
    const execFunc = new Function('data', 'console', 'result', jsCode + '\nreturn result;');
    const result = execFunc(sandbox.data, sandbox.console, sandbox.result);
    
    console.log('=== EXECUTION RESULT ===');
    console.log('Stdout:', sandbox.stdout);
    console.log('Result:', result);
    console.log('===================');
    
    return {
      ok: true,
      stdout: sandbox.stdout || 'Code executed successfully',
      result: result || sandbox.data
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