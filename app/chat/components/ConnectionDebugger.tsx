'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { AgentEvent } from '@/lib/types';

interface Props {
  sessionId: string;
}

export default function ConnectionDebugger({ sessionId }: Props) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [eventCount, setEventCount] = useState(0);
  const [lastEvent, setLastEvent] = useState<string>('none');
  
  useEffect(() => {
    console.log('ConnectionDebugger: Starting SSE connection');
    const eventSource = new EventSource(`/api/stream?session=${sessionId}`);
    
    eventSource.onopen = () => {
      console.log('ConnectionDebugger: Connection opened');
      setStatus('connected');
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data: AgentEvent = JSON.parse(event.data);
        console.log('ConnectionDebugger: Received event:', data.type);
        setEventCount(prev => prev + 1);
        setLastEvent(data.type);
      } catch (error) {
        console.error('ConnectionDebugger: Parse error:', error);
      }
    };
    
    eventSource.onerror = () => {
      console.error('ConnectionDebugger: Connection error');
      setStatus('error');
    };
    
    return () => {
      console.log('ConnectionDebugger: Closing connection');
      eventSource.close();
    };
  }, [sessionId]);
  
  return (
    <Card className="fixed top-4 right-4 p-4 text-xs font-mono bg-black text-green-400 z-50">
      <div>Session: {sessionId}</div>
      <div>Status: {status}</div>
      <div>Events: {eventCount}</div>
      <div>Last: {lastEvent}</div>
    </Card>
  );
}