'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { AgentEvent } from '@/lib/types';
import { useEvents } from './EventContext';

interface Props {
  sessionId: string;
}

export default function ConnectionDebugger({ sessionId }: Props) {
  const [eventCount, setEventCount] = useState(0);
  const [lastEvent, setLastEvent] = useState<string>('none');
  const { subscribe, connected } = useEvents();
  
  useEffect(() => {
    console.log('ConnectionDebugger: Setting up event subscription');
    
    const unsubscribe = subscribe((event: AgentEvent) => {
      console.log('ConnectionDebugger: Received event:', event.type);
      setEventCount(prev => prev + 1);
      setLastEvent(event.type);
    });
    
    return unsubscribe;
  }, [subscribe]);
  
  return (
    <Card className="fixed top-4 right-4 p-4 text-xs font-mono bg-black text-green-400 z-50">
      <div>Session: {sessionId}</div>
      <div>Status: {connected ? 'connected' : 'connecting'}</div>
      <div>Events: {eventCount}</div>
      <div>Last: {lastEvent}</div>
    </Card>
  );
}