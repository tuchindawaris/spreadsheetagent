import { NextRequest, NextResponse } from 'next/server';
import { runAgentPipeline } from '@/lib/agent/orchestrator';
import { AgentContext } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('=== AGENT API REQUEST ===');
    console.log('Prompt:', body.prompt);
    console.log('Session ID:', body.sessionId);
    console.log('Sheet Model Tables:', body.sheetModel?.tables?.map((t: any) => ({
      name: t.name,
      columns: t.columns.map((c: any) => c.name),
      rowCount: t.rows.length
    })));
    console.log('===================');
    
    const { prompt, sheetModel, sessionId } = body;
    
    if (!prompt || !sheetModel || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const context: AgentContext = {
      sessionId,
      prompt,
      sheetModel,
      maxRetries: 2,
      maxGptCalls: 10,
      gptCallCount: 0
    };
    
    // Start agent pipeline in background
    runAgentPipeline(context)
      .then(() => console.log('Agent pipeline completed'))
      .catch(err => console.error('Agent pipeline error:', err));
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json(
      { error: 'Failed to start agent' },
      { status: 500 }
    );
  }
}