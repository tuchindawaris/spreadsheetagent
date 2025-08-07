'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { AgentEvent } from '@/lib/types';

interface EventContextType {
  subscribe: (callback: (event: AgentEvent) => void) => () => void;
  connected: boolean;
}

const EventContext = createContext<EventContextType | null>(null);

export function EventProvider({ children, sessionId }: { children: ReactNode; sessionId: string }) {
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const subscribersRef = useRef<Set<(event: AgentEvent) => void>>(new Set());
  
  useEffect(() => {
    console.log('EventProvider: Connecting to SSE stream with session:', sessionId);
    
    const eventSource = new EventSource(`/api/stream?session=${sessionId}`);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      console.log('EventProvider: SSE connection opened');
      setConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data: AgentEvent = JSON.parse(event.data);
        console.log('EventProvider: Broadcasting event:', data.type, 'to', subscribersRef.current.size, 'subscribers');
        
        // Broadcast to all local subscribers
        subscribersRef.current.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error('EventProvider: Error in subscriber callback:', error);
          }
        });
      } catch (error) {
        console.error('EventProvider: Error parsing SSE data:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('EventProvider: SSE error:', error);
      setConnected(false);
    };
    
    return () => {
      console.log('EventProvider: Cleaning up SSE connection');
      eventSource.close();
      setConnected(false);
    };
  }, [sessionId]);
  
  const subscribe = (callback: (event: AgentEvent) => void) => {
    subscribersRef.current.add(callback);
    console.log('EventProvider: Added subscriber, total:', subscribersRef.current.size);
    
    return () => {
      subscribersRef.current.delete(callback);
      console.log('EventProvider: Removed subscriber, remaining:', subscribersRef.current.size);
    };
  };
  
  return (
    <EventContext.Provider value={{ subscribe, connected }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvents() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvents must be used within EventProvider');
  }
  return context;
}