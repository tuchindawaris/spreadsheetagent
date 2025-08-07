import { NextRequest, NextResponse } from 'next/server';
import { eventBus } from '@/lib/bus';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session');
  
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Missing session ID' },
      { status: 400 }
    );
  }
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(`data: {"type":"connected"}\n\n`);
      
      // Subscribe to events
      const unsubscribe = eventBus.subscribe(sessionId, (event) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(data);
      });
      
      // Clean up on close
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        eventBus.clear(sessionId);
        controller.close();
      });
    }
  });
  
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}