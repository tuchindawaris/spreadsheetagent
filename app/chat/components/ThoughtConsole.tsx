'use client';

import { useState, useEffect, useRef } from 'react';
import { Brain } from 'lucide-react';
import { AgentEvent } from '@/lib/types';
import { useEvents } from './EventContext';

interface Props {
  sessionId: string;
}

export default function ThoughtConsole({ sessionId }: Props) {
  const [thoughts, setThoughts] = useState<string[]>([]);
  const { subscribe } = useEvents();
  const bottomRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const unsubscribe = subscribe((event: AgentEvent) => {
      if (event.type === 'thought') {
        setThoughts(prev => [...prev, event.message]);
      } else if (event.type === 'answer') {
        // Clear thoughts after a delay when answer is received
        setTimeout(() => {
          setThoughts([]);
        }, 2000);
      }
    });
    
    return unsubscribe;
  }, [subscribe]);
  
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thoughts]);
  
  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Agent Log</h2>
        <span className="text-sm text-gray-500">({thoughts.length})</span>
      </div>
      
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded p-3 font-mono text-xs">
        {thoughts.length === 0 ? (
          <div className="text-gray-500">Waiting for activity...</div>
        ) : (
          <div className="space-y-1">
            {thoughts.map((thought, idx) => (
              <div key={idx} className="text-gray-700">
                <span className="text-gray-400">[{new Date().toLocaleTimeString()}]</span>{' '}
                {thought}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}