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
      
      // Send connected event immediately
      send(`data: {"type":"connected"}\n\n`);
      
      // Subscribe to events
      const unsubscribe = eventBus.subscribe(sessionId, (event) => {
        console.log('Sending SSE event:', { sessionId, type: event.type });
        const data = `data: ${JSON.stringify(event)}\n\n`;
        send(data);
      });
      
      // Log subscriber count after subscribing
      console.log(`SSE subscriber added. Total subscribers for session ${sessionId}: ${eventBus.getSubscriberCount(sessionId)}`);
      
      // Send a test event to verify connection
      setTimeout(() => {
        console.log(`Sending test event for session ${sessionId}`);
        eventBus.publish(sessionId, {
          type: 'thought',
          message: '✅ Connection established successfully'
        });
      }, 100);
      
      // Keep connection alive with periodic pings
      const pingInterval = setInterval(() => {
        send(`:ping\n\n`);
      }, 30000); // Every 30 seconds
      
      // Clean up on close
      request.signal.addEventListener('abort', () => {
        console.log('SSE connection closed for session:', sessionId);
        console.log(`Subscribers before cleanup: ${eventBus.getSubscriberCount(sessionId)}`);
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