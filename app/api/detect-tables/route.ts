import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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
  typeSignature?: string;
  isEmptyRow?: boolean;
  isWhitespaceRow?: boolean;
  transitionScore?: number;
}

export async function POST(request: NextRequest) {
  console.log('Table detection API called');
  
  try {
    const body = await request.json();
    const { samples, totalRows, includesTypeAnalysis } = body;
    
    console.log(`Received ${samples?.length || 0} samples for ${totalRows} total rows`);
    console.log(`Type analysis included: ${includesTypeAnalysis}`);
    
    if (!samples || !Array.isArray(samples)) {
      return NextResponse.json(
        { error: 'Invalid samples data' },
        { status: 400 }
      );
    }
    
    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not found');
      return NextResponse.json({
        boundaries: [{
          startRow: 0,
          endRow: totalRows - 1,
          description: 'Full sheet (no API key available)'
        }]
      });
    }
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Create enhanced prompt for LLM
    let samplesDescription = '';
    
    if (includesTypeAnalysis) {
      // Enhanced format with type signatures
      samplesDescription = samples.map((s: RowSample) => {
        const rowData = s.data.map((cell: any) => {
          if (cell === null || cell === undefined || cell === '') return '[empty]';
          if (typeof cell === 'string' && cell.trim() === '') return '[whitespace]';
          return String(cell).slice(0, 30) + (String(cell).length > 30 ? '...' : '');
        }).join(' | ');
        
        let description = `Row ${s.rowIndex}`;
        if (s.typeSignature) {
          description += ` [Type: ${s.typeSignature}]`;
        }
        if (s.hasMerge) {
          description += ' [MERGED]';
        }
        if (s.isEmptyRow) {
          description += ' [ALL EMPTY]';
        } else if (s.isWhitespaceRow) {
          description += ' [WHITESPACE]';
        }
        if (s.transitionScore !== undefined) {
          description += ` [Transition: ${s.transitionScore.toFixed(1)}]`;
        }
        description += `: ${rowData}`;
        
        return description;
      }).join('\n');
    } else {
      // Legacy format
      samplesDescription = samples.map((s: RowSample) => {
        const rowData = s.data.map((cell: any) => {
          if (cell === null || cell === undefined || cell === '') return '[empty]';
          return String(cell).slice(0, 30) + (String(cell).length > 30 ? '...' : '');
        }).join(' | ');
        return `Row ${s.rowIndex}${s.hasMerge ? ' [MERGED]' : ''}: ${rowData}`;
      }).join('\n');
    }
    
    const typeSystemExplanation = includesTypeAnalysis ? `
Type Signature Legend:
- E = Empty cell (null, undefined, or empty string)
- W = Whitespace only
- T = Text (non-numeric string)
- N = Number (including currency and percentages)
- D = Date/Time
- B = Boolean
- F = Formula (cells starting with =)
- M = Merged cell (not the master cell)
- X = Unknown/Complex

Transition scores (0-10) indicate how different consecutive rows are:
- 0 = Identical pattern
- 8-10 = Major change (likely table boundary)
- Empty rows (all E) between different patterns strongly indicate boundaries

IMPORTANT: Pay special attention to type pattern changes. When you see:
1. A row of all text (TTTT) after rows with numbers (TNNN) = likely new header
2. Empty rows (EEEE) between different patterns = table boundary
3. Sudden pattern change (e.g., TNND to TTNE) = possible new table
4. Whitespace rows between sections = intentional separation by user` : '';

    const prompt = `Analyze this spreadsheet data and identify separate tables. Each table should have its own consistent structure and headers.

${typeSystemExplanation}

Data samples (showing row index, type signature, special markers, and row data):
${samplesDescription}

Total rows in sheet: ${totalRows}

Rules for detecting table boundaries:
1. Look for DATA TYPE PATTERN CHANGES as primary indicator:
   - Rows with all empty cells (type signature all E) often separate tables
   - When numeric data rows (containing N) change to all text rows (all T), it often indicates new headers
   - Significant type signature changes (high transition scores) suggest boundaries
   
2. Traditional indicators still apply:
   - Merged cells in the data area (not just headers)
   - Multiple empty or whitespace-only rows
   - Completely different column structure or data theme

3. Implicit table detection:
   - Users often separate tables with just empty rows (no borders/formatting)
   - A text row after numeric data rows likely starts a new table
   - Consistent type patterns group rows into the same table

4. Headers can span multiple rows (with or without merges)
5. Each table should have clear boundaries based on data patterns

Return a JSON object with a "boundaries" property containing an array:
{
  "boundaries": [{
    "startRow": number,
    "endRow": number,
    "mergeHeader": "string if there's a merged cell header above this table",
    "description": "brief description of what this table contains"
  }]
}

Focus on the TYPE PATTERNS to detect implicit table structures, not just visual formatting.`;

    console.log('Calling OpenAI API with enhanced type analysis...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { 
          role: 'system', 
          content: 'You are a spreadsheet analysis expert specializing in detecting logical table boundaries using data type patterns. You understand that users often create implicit table structures using empty rows and type changes rather than explicit formatting. Always return a valid JSON object with a boundaries array.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1000
    });
    
    const rawContent = response.choices[0].message.content!;
    console.log('Raw LLM response:', rawContent.substring(0, 200) + '...');
    
    let result;
    try {
      result = JSON.parse(rawContent);
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
      throw new Error('Invalid JSON from LLM');
    }
    
    // Extract boundaries array from the response
    let boundaries: TableBoundary[] = [];
    
    if (result && result.boundaries && Array.isArray(result.boundaries)) {
      boundaries = result.boundaries;
    } else {
      console.error('Unexpected LLM response format:', result);
      throw new Error('Invalid response format from LLM');
    }
    
    console.log(`Found ${boundaries.length} table boundaries using type analysis`);
    
    // Log boundary details
    boundaries.forEach((b, idx) => {
      console.log(`Boundary ${idx + 1}: rows ${b.startRow}-${b.endRow}`, 
        b.description ? `(${b.description})` : '');
    });
    
    // Validate and adjust boundaries
    const validBoundaries: TableBoundary[] = [];
    for (const boundary of boundaries) {
      // Ensure boundaries are within data range
      if (boundary && 
          typeof boundary.startRow === 'number' &&
          typeof boundary.endRow === 'number' &&
          boundary.startRow >= 0 && 
          boundary.endRow < totalRows && 
          boundary.startRow <= boundary.endRow) {
        validBoundaries.push(boundary);
      } else {
        console.warn('Invalid boundary skipped:', boundary);
      }
    }
    
    // If no boundaries detected, treat entire sheet as one table
    if (validBoundaries.length === 0) {
      console.log('No valid boundaries found, using full sheet');
      validBoundaries.push({
        startRow: 0,
        endRow: totalRows - 1,
        description: 'Full sheet'
      });
    }
    
    console.log(`Returning ${validBoundaries.length} valid boundaries`);
    return NextResponse.json({ boundaries: validBoundaries });
    
  } catch (error: any) {
    console.error('Table detection error:', error.message || error);
    
    // Return a default single table boundary
    const totalRows = body?.totalRows || 100;
    return NextResponse.json({ 
      boundaries: [{
        startRow: 0,
        endRow: totalRows - 1,
        description: 'Full sheet (fallback due to error)'
      }]
    });
  }
}