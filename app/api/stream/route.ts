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
  
  console.log('SSE connection established for session:', sessionId);
  
  // Create a TransformStream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const send = (data: string) => {
        controller.enqueue(encoder.encode(data));
      };
      
      send(`data: {"type":"connected"}\n\n`);
      
      // Subscribe to events
      const unsubscribe = eventBus.subscribe(sessionId, (event) => {
        console.log('Sending SSE event:', { sessionId, type: event.type });
        const data = `data: ${JSON.stringify(event)}\n\n`;
        send(data);
      });
      
      // Keep connection alive with periodic pings
      const pingInterval = setInterval(() => {
        send(`:ping\n\n`);
      }, 30000); // Every 30 seconds
      
      // Clean up on close
      request.signal.addEventListener('abort', () => {
        console.log('SSE connection closed for session:', sessionId);
        clearInterval(pingInterval);
        unsubscribe();
        eventBus.clear(sessionId);
        controller.close();
      });
    }
  });
  
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    }
  });
}