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

interface RowSample {
  rowIndex: number;
  data: any[];
  hasMerge: boolean;
  typeSignature: string;
  isEmptyRow: boolean;
  isWhitespaceRow: boolean;
  transitionScore?: number;
}

// Generate type signature for a cell
function getCellType(value: any): string {
  if (value === null || value === undefined || value === '') {
    return 'E'; // Empty
  }
  
  if (typeof value === 'string') {
    if (value.trim() === '') {
      return 'W'; // Whitespace only
    }
    // Check if it's a date-like string
    const datePattern = /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/;
    if (datePattern.test(value)) {
      return 'D'; // Date
    }
    // Check if it's a number string (including currency and percentages)
    const cleanValue = value.replace(/[$,£€¥₹%]/g, '').trim();
    const numValue = Number(cleanValue);
    if (!isNaN(numValue) && cleanValue !== '') {
      return 'N'; // Number (including currency and percentages)
    }
    return 'T'; // Text
  }
  
  if (typeof value === 'number') {
    return 'N'; // Number
  }
  
  if (value instanceof Date) {
    return 'D'; // Date
  }
  
  if (typeof value === 'boolean') {
    return 'B'; // Boolean
  }
  
  return 'X'; // Unknown/Complex
}

// Generate type signature for a row (including merge info)
function getRowTypeSignature(row: any[], mergeMap?: Map<string, MergeInfo>, rowIndex?: number): string {
  return row.map((cell, colIndex) => {
    // Check if this cell is part of a merge
    if (mergeMap && rowIndex !== undefined) {
      const cellAddr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      const mergeInfo = mergeMap.get(cellAddr);
      if (mergeInfo && (mergeInfo.s.r !== rowIndex || mergeInfo.s.c !== colIndex)) {
        // This is a merged cell but not the master cell
        return 'M'; // Merged
      }
    }
    return getCellType(cell);
  }).join('');
}

// Calculate transition score between two type signatures
function calculateTransitionScore(sig1: string, sig2: string): number {
  if (!sig1 || !sig2) return 0;
  if (sig1 === sig2) return 0;
  
  // All empty to non-empty or vice versa
  if (sig1.match(/^E+$/) && !sig2.match(/^E+$/)) return 10;
  if (!sig1.match(/^E+$/) && sig2.match(/^E+$/)) return 10;
  
  // All whitespace to non-whitespace
  if (sig1.match(/^[EW]+$/) && !sig2.match(/^[EW]+$/)) return 9;
  if (!sig1.match(/^[EW]+$/) && sig2.match(/^[EW]+$/)) return 9;
  
  // All text (potential header) after numbers
  if (sig1.includes('N') && sig2.match(/^[TW]+$/)) return 8;
  
  // Data pattern to all text (likely new headers)
  if (sig1.match(/[TN]+/) && sig2.match(/^T+$/)) return 7;
  
  // Major pattern change (more than 50% of columns change type)
  let changes = 0;
  const maxLen = Math.max(sig1.length, sig2.length);
  for (let i = 0; i < maxLen; i++) {
    if ((sig1[i] || 'E') !== (sig2[i] || 'E')) changes++;
  }
  
  return Math.min(10, (changes / maxLen) * 10);
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
          
          // Use LLM to detect table boundaries with enhanced type analysis
          const boundaries = await detectTableBoundariesWithLLM(rawData, merges, mergeMap);
          
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
  merges: MergeInfo[],
  mergeMap: Map<string, MergeInfo>
): Promise<TableBoundary[]> {
  console.log('Starting table boundary detection with type analysis...');
  
  // Prepare enhanced data samples with type signatures
  const samples: RowSample[] = [];
  
  // Generate type signatures for all rows
  const allTypeSignatures = rawData.map((row, idx) => getRowTypeSignature(row, mergeMap, idx));
  
  // Log first few type signatures for debugging
  console.log('First 10 type signatures:');
  allTypeSignatures.slice(0, 10).forEach((sig, idx) => {
    console.log(`Row ${idx}: ${sig}`);
  });
  
  // Always include first 5 rows
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    const typeSignature = allTypeSignatures[i];
    samples.push({
      rowIndex: i,
      data: rawData[i],
      hasMerge: merges.some(m => m.s.r === i),
      typeSignature,
      isEmptyRow: typeSignature.match(/^E+$/) !== null,
      isWhitespaceRow: typeSignature.match(/^[EW]+$/) !== null && typeSignature.includes('W')
    });
  }
  
  // Find potential boundaries based on type transitions
  const significantTransitions: number[] = [];
  for (let i = 1; i < rawData.length; i++) {
    const prevSig = allTypeSignatures[i - 1];
    const currSig = allTypeSignatures[i];
    const transitionScore = calculateTransitionScore(prevSig, currSig);
    
    // Log significant transitions
    if (transitionScore >= 5) {
      console.log(`Significant transition at row ${i}: ${prevSig} → ${currSig} (score: ${transitionScore})`);
      significantTransitions.push(i);
      
      // Include context (2 rows before and after)
      for (let j = Math.max(0, i - 2); j <= Math.min(rawData.length - 1, i + 2); j++) {
        if (!samples.some(s => s.rowIndex === j)) {
          const sig = allTypeSignatures[j];
          samples.push({
            rowIndex: j,
            data: rawData[j],
            hasMerge: merges.some(m => m.s.r === j),
            typeSignature: sig,
            isEmptyRow: sig.match(/^E+$/) !== null,
            isWhitespaceRow: sig.match(/^[EW]+$/) !== null && sig.includes('W'),
            transitionScore: j === i ? transitionScore : undefined
          });
        }
      }
    }
    
    // Also include rows with merges
    const hasMerge = merges.some(m => m.s.r === i);
    if (hasMerge && !samples.some(s => s.rowIndex === i)) {
      const sig = allTypeSignatures[i];
      samples.push({
        rowIndex: i,
        data: rawData[i],
        hasMerge: true,
        typeSignature: sig,
        isEmptyRow: sig.match(/^E+$/) !== null,
        isWhitespaceRow: sig.match(/^[EW]+$/) !== null && sig.includes('W')
      });
    }
  }
  
  // Sort samples by row index
  samples.sort((a, b) => a.rowIndex - b.rowIndex);
  
  console.log(`Found ${significantTransitions.length} significant type transitions`);
  console.log(`Sending ${samples.length} row samples to LLM for analysis`);
  
  try {
    // Call server API for LLM detection with enhanced samples
    const response = await fetch('/api/detect-tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        samples,
        totalRows: rawData.length,
        includesTypeAnalysis: true
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
    console.error('LLM table detection failed, using enhanced fallback with type patterns:', error);
    
    // Enhanced fallback using type patterns
    const boundaries: TableBoundary[] = [];
    let currentStart = 0;
    
    console.log('Running fallback table detection...');
    
    for (let r = 1; r < rawData.length; r++) {
      const prevSig = allTypeSignatures[r - 1];
      const currSig = allTypeSignatures[r];
      const score = calculateTransitionScore(prevSig, currSig);
      
      // Detect boundary if:
      // 1. High transition score
      // 2. Merged cell appears
      // 3. Multiple empty rows
      const hasHighScore = score >= 8;
      const hasMerge = merges.some(m => m.s.r === r && r > currentStart);
      const hasMultipleEmpty = currSig.match(/^E+$/) && allTypeSignatures[r + 1]?.match(/^E+$/);
      
      if (hasHighScore || hasMerge || hasMultipleEmpty) {
        console.log(`Fallback: Boundary detected at row ${r} (score: ${score}, merge: ${hasMerge}, empty: ${hasMultipleEmpty})`);
        
        // End current table before this row
        if (r > currentStart) {
          boundaries.push({
            startRow: currentStart,
            endRow: r - 1,
            description: `Section ${boundaries.length + 1}`
          });
        }
        
        // Skip empty rows
        while (r < rawData.length && allTypeSignatures[r].match(/^E+$/)) {
          r++;
        }
        
        currentStart = r;
      }
    }
    
    // Add final boundary
    if (currentStart < rawData.length) {
      boundaries.push({
        startRow: currentStart,
        endRow: rawData.length - 1,
        description: `Section ${boundaries.length + 1}`
      });
    }
    
    // If no boundaries found, treat as single table
    if (boundaries.length === 0) {
      boundaries.push({
        startRow: 0,
        endRow: rawData.length - 1,
        description: 'Full sheet'
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
  // Enhanced header detection using type patterns
  let headerRowCount = 1;
  
  // Generate type signatures for first 10 rows (without merge map for now)
  const signatures = rawData.slice(0, 10).map(row => getRowTypeSignature(row));
  
  // Strategy 1: Look for the first row with consistent numeric pattern
  for (let r = 0; r < signatures.length; r++) {
    const sig = signatures[r];
    const nextSig = signatures[r + 1];
    
    // If current row is mostly text and next row has numbers, current row is likely the last header
    if (sig.match(/^[TW]+$/) && nextSig && nextSig.includes('N')) {
      headerRowCount = r + 1;
      break;
    }
    
    // If we find a row with a good mix of text and numbers (typical data row)
    if (sig.match(/T.*N/) && r > 0) {
      headerRowCount = r;
      break;
    }
  }
  
  // Strategy 2: Check merge patterns
  let lastMergedHeaderRow = 0;
  merges.forEach(merge => {
    if (merge.s.r < 10) { // Only check first 10 rows for header merges
      lastMergedHeaderRow = Math.max(lastMergedHeaderRow, merge.e.r + 1);
    }
  });
  
  if (lastMergedHeaderRow > 0) {
    headerRowCount = Math.max(headerRowCount, lastMergedHeaderRow);
  }
  
  // Strategy 3: Look for empty rows that might separate headers from data
  for (let r = 0; r < Math.min(5, signatures.length); r++) {
    if (signatures[r].match(/^E+$/) && r > 0) {
      // Empty row found, headers are likely above this
      headerRowCount = r;
      break;
    }
  }
  
  // Ensure we have at least 1 header row
  return Math.max(1, Math.min(headerRowCount, 5)); // Cap at 5 header rows max
}

function getCellValue(cell: any): any {
  if (!cell) return null;
  
  // Handle different cell types
  if (cell.t === 'n') return cell.v; // number
  if (cell.t === 's') return cell.v; // string
  if (cell.t === 'b') return cell.v; // boolean
  if (cell.t === 'd') return cell.v; // date
  if (cell.t === 'e') return cell.w || cell.v; // error
  
  // Handle formulas - the cell.f property contains the formula
  if (cell.f && cell.v !== undefined) {
    // Return the calculated value, but we could mark this as formula-derived
    return cell.v;
  }
  
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