'use client';

import { useState, useEffect, useRef } from 'react';
import { Brain, CheckCircle, XCircle, RefreshCw, Terminal } from 'lucide-react';
import { AgentEvent } from '@/lib/types';
import { useEvents } from './EventContext';

interface Props {
  sessionId: string;
}

interface ThoughtEntry {
  message: string;
  timestamp: Date;
  type: 'info' | 'error' | 'success' | 'console' | 'retry';
  icon?: any;
}

export default function ThoughtStream({ sessionId }: Props) {
  const [thoughts, setThoughts] = useState<ThoughtEntry[]>([]);
  const { subscribe } = useEvents();
  const bottomRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const unsubscribe = subscribe((event: AgentEvent) => {
      if (event.type === 'thought') {
        // Determine thought type and icon based on message content
        let type: ThoughtEntry['type'] = 'info';
        let icon = Brain;
        
        if (event.message.includes('❌') || event.message.includes('Error')) {
          type = 'error';
          icon = XCircle;
        } else if (event.message.includes('✅') || event.message.includes('✨')) {
          type = 'success';
          icon = CheckCircle;
        } else if (event.message.includes('📝 Console:')) {
          type = 'console';
          icon = Terminal;
        } else if (event.message.includes('🔄 Retry')) {
          type = 'retry';
          icon = RefreshCw;
        }
        
        setThoughts(prev => [...prev, {
          message: event.message,
          timestamp: new Date(),
          type,
          icon
        }]);
      }
    });
    
    return unsubscribe;
  }, [subscribe]);
  
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thoughts]);
  
  const getTypeStyles = (type: ThoughtEntry['type']) => {
    switch (type) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'console': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'retry': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Agent Thoughts</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Live feed of analysis process
        </p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {thoughts.length === 0 ? (
          <div className="text-center py-12">
            <Brain className="h-12 w-12 text-gray-300 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-500 text-sm">Waiting for activity...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {thoughts.map((thought, idx) => {
              const Icon = thought.icon;
              return (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 text-xs ${getTypeStyles(thought.type)} animate-in fade-in slide-in-from-left`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="break-words">
                        {thought.message}
                      </div>
                      <div className="text-xs opacity-60 mt-1">
                        {thought.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      
      {thoughts.length > 0 && (
        <div className="p-4 border-t">
          <button
            onClick={() => setThoughts([])}
            className="text-xs text-gray-500 hover:text-gray-700 w-full text-center"
          >
            Clear log
          </button>
        </div>
      )}
    </div>
  );
}