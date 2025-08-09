import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface TableBoundary {
  startRow: number;
  endRow: number;
  mergeHeader?: string;
  description?: string;
}

export async function POST(request: NextRequest) {
  console.log('Table detection API called');
  
  try {
    const body = await request.json();
    const { samples, totalRows } = body;
    
    console.log(`Received ${samples?.length || 0} samples for ${totalRows} total rows`);
    
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
    
    // Create prompt for LLM
    const prompt = `Analyze this spreadsheet data and identify separate tables. Each table should have its own consistent structure and headers.

Data samples (showing row index, whether it has merged cells, and the row data):
${samples.map((s: any) => {
  const rowData = s.data.map((cell: any) => {
    if (cell === null || cell === undefined || cell === '') return '[empty]';
    return String(cell).slice(0, 30) + (String(cell).length > 30 ? '...' : '');
  }).join(' | ');
  return `Row ${s.rowIndex}${s.hasMerge ? ' [MERGED]' : ''}: ${rowData}`;
}).join('\n')}

Total rows in sheet: ${totalRows}

Rules:
1. A new table starts when you see:
   - Merged cells in the data area (not just headers)
   - Multiple empty rows followed by new headers
   - Completely different column structure or data theme
2. Headers can span multiple rows (with or without merges)
3. Each table should have clear boundaries

Return a JSON object with a "boundaries" property containing an array:
{
  "boundaries": [{
    "startRow": number,
    "endRow": number,
    "mergeHeader": "string if there's a merged cell header above this table",
    "description": "brief description of what this table contains"
  }]
}`;

    console.log('Calling OpenAI API...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview', // More reliable than gpt-4o which might not be available
      messages: [
        { 
          role: 'system', 
          content: 'You are a spreadsheet analysis expert. Identify logical table boundaries in spreadsheet data. Always return a valid JSON object with a boundaries array.'
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
    
    console.log(`Found ${boundaries.length} table boundaries`);
    
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