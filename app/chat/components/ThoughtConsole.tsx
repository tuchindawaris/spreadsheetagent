'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronUp, ChevronDown, Brain } from 'lucide-react';
import { AgentEvent } from '@/lib/types';
import { useEvents } from './EventContext';

interface Props {
  sessionId: string;
}

export default function ThoughtConsole({ sessionId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [thoughts, setThoughts] = useState<string[]>([]);
  const { subscribe } = useEvents();
  
  useEffect(() => {
    console.log('ThoughtConsole: Setting up event subscription');
    
    const unsubscribe = subscribe((event: AgentEvent) => {
      console.log('ThoughtConsole: Received event:', event.type);
      
      if (event.type === 'thought') {
        setThoughts(prev => [...prev, event.message]);
        // Auto-open console when first thought arrives
        if (thoughts.length === 0) {
          setIsOpen(true);
        }
      } else if (event.type === 'answer') {
        // Clear thoughts when answer is received
        setTimeout(() => {
          setThoughts([]);
          setIsOpen(false);
        }, 2000);
      }
    });
    
    return unsubscribe;
  }, [subscribe, thoughts.length]);
  
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