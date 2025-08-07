'use client';

import { useState, useEffect, useRef } from 'react';
import { Brain } from 'lucide-react';
import { AgentEvent } from '@/lib/types';
import { useEvents } from './EventContext';

interface Props {
  sessionId: string;
}

interface ThoughtEntry {
  message: string;
  timestamp: Date;
  type: 'info' | 'error' | 'success' | 'console' | 'retry';
}

export default function ThoughtConsole({ sessionId }: Props) {
  const [thoughts, setThoughts] = useState<ThoughtEntry[]>([]);
  const { subscribe } = useEvents();
  const bottomRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const unsubscribe = subscribe((event: AgentEvent) => {
      if (event.type === 'thought') {
        // Determine thought type based on message content
        let type: ThoughtEntry['type'] = 'info';
        if (event.message.includes('❌') || event.message.includes('Error')) {
          type = 'error';
        } else if (event.message.includes('✅') || event.message.includes('✨')) {
          type = 'success';
        } else if (event.message.includes('📝 Console:')) {
          type = 'console';
        } else if (event.message.includes('🔄 Retry')) {
          type = 'retry';
        }
        
        setThoughts(prev => [...prev, {
          message: event.message,
          timestamp: new Date(),
          type
        }]);
      } else if (event.type === 'answer') {
        // Don't clear thoughts immediately - keep them visible
      }
    });
    
    return unsubscribe;
  }, [subscribe]);
  
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thoughts]);
  
  const getMessageColor = (type: ThoughtEntry['type']) => {
    switch (type) {
      case 'error': return 'text-red-600';
      case 'success': return 'text-green-600';
      case 'console': return 'text-blue-600';
      case 'retry': return 'text-yellow-600';
      default: return 'text-gray-700';
    }
  };
  
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
              <div key={idx} className={`${getMessageColor(thought.type)} break-words`}>
                <span className="text-gray-400">
                  [{thought.timestamp.toLocaleTimeString()}]
                </span>{' '}
                <span className={thought.type === 'console' ? 'ml-4' : ''}>
                  {thought.message}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      
      {thoughts.length > 0 && (
        <button
          onClick={() => setThoughts([])}
          className="mt-2 text-xs text-gray-500 hover:text-gray-700"
        >
          Clear log
        </button>
      )}
    </div>
  );
}