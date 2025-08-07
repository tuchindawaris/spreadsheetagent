import { NextRequest, NextResponse } from 'next/server';
import { runAgentPipeline } from '@/lib/agent/orchestrator';
import { AgentContext } from '@/lib/types';
import { eventBus } from '@/lib/bus';

async function waitForSubscribers(sessionId: string, maxWaitTime: number = 5000): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 100; // Check every 100ms
  
  console.log(`Waiting for subscribers to connect for session: ${sessionId}`);
  
  while (Date.now() - startTime < maxWaitTime) {
    const subscriberCount = eventBus.getSubscriberCount(sessionId);
    console.log(`[${Date.now() - startTime}ms] Subscriber count: ${subscriberCount}`);
    
    if (subscriberCount > 0) {
      console.log(`✅ Subscribers connected! Count: ${subscriberCount}`);
      // Give a tiny bit more time for all subscribers to stabilize
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  console.log(`❌ Timeout waiting for subscribers after ${maxWaitTime}ms`);
  return false;
}

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
    
    // Start async process to wait for subscribers then run pipeline
    (async () => {
      try {
        // Wait for subscribers to connect (up to 5 seconds)
        const hasSubscribers = await waitForSubscribers(sessionId, 5000);
        
        if (!hasSubscribers) {
          console.error('No subscribers connected, but proceeding anyway...');
          // You could emit an error event here instead
          eventBus.publish(sessionId, {
            type: 'thought',
            message: '⚠️ Connection issue detected, but proceeding with analysis...'
          });
        }
        
        // Final subscriber count check
        const finalCount = eventBus.getSubscriberCount(sessionId);
        console.log(`Starting pipeline with ${finalCount} subscribers`);
        
        // Run the pipeline
        await runAgentPipeline(context);
        console.log('Agent pipeline completed');
      } catch (err) {
        console.error('Agent pipeline error:', err);
        // Try to send error to subscribers
        eventBus.publish(sessionId, {
          type: 'answer',
          content: {
            markdown: `Error: ${err instanceof Error ? err.message : 'Unknown error occurred'}`
          }
        });
      }
    })();
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json(
      { error: 'Failed to start agent' },
      { status: 500 }
    );
  }
}