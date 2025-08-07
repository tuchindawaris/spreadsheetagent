'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronUp, ChevronDown, Brain } from 'lucide-react';
import { AgentEvent } from '@/lib/types';

export default function ThoughtConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [sessionId] = useState(() => {
    // Get sessionId from sessionStorage to sync with ChatPanel
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('currentSessionId') || Math.random().toString(36).substring(7);
    }
    return '';
  });
  
  useEffect(() => {
    if (!sessionId) return;
    
    // Store sessionId for ChatPanel to use
    sessionStorage.setItem('currentSessionId', sessionId);
    
    const eventSource = new EventSource(`/api/stream?session=${sessionId}`);
    
    eventSource.onmessage = (event) => {
      const data: AgentEvent = JSON.parse(event.data);
      
      if (data.type === 'thought') {
        setThoughts(prev => [...prev, data.message]);
      }
    };
    
    return () => eventSource.close();
  }, [sessionId]);
  
  return (
    <div className={`fixed bottom-0 left-0 right-0 transition-transform ${isOpen ? 'translate-y-0' : 'translate-y-48'}`}>
      <Card className="rounded-t-lg rounded-b-none shadow-lg">
        <div className="flex items-center justify-between p-3 border-b cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span className="font-medium">Agent Thoughts</span>
            <span className="text-sm text-gray-500">({thoughts.length})</span>
          </div>
          <Button variant="ghost" size="sm">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
        
        {isOpen && (
          <div className="h-48 overflow-y-auto p-4">
            <div className="space-y-2">
              {thoughts.length === 0 ? (
                <div className="text-sm text-gray-500">No thoughts yet...</div>
              ) : (
                thoughts.map((thought, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="text-gray-400">[{new Date().toLocaleTimeString()}]</span>{' '}
                    {thought}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}