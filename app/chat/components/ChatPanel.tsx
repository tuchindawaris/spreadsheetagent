'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { SheetModel, AgentEvent, AnswerPayload } from '@/lib/types';
import { Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEvents } from './EventContext';

interface Props {
  sheetModel: SheetModel;
  onHighlight: (range: { sheetId: string; range: string } | null) => void;
  sessionId: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: AnswerPayload;
}

export default function ChatPanel({ sheetModel, onHighlight, sessionId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { subscribe, connected } = useEvents();
  
  console.log('ChatPanel: Render', { connected, sessionId });
  
  useEffect(() => {
    console.log('ChatPanel: Setting up event subscription for session:', sessionId);
    
    const unsubscribe = subscribe((event: AgentEvent) => {
      console.log('ChatPanel: Received event:', event.type);
      
      switch (event.type) {
        case 'highlight':
          onHighlight({ sheetId: event.sheetId, range: event.range });
          break;
        case 'answer':
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: event.content.markdown,
            data: event.content
          }]);
          setLoading(false);
          break;
      }
    });
    
    console.log('ChatPanel: Subscription created');
    
    return () => {
      console.log('ChatPanel: Cleaning up subscription');
      unsubscribe();
    };
  }, [subscribe, onHighlight, sessionId]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSubmit = async () => {
    console.log('ChatPanel: handleSubmit', { connected, inputLength: input.length, loading });
    
    if (!input.trim() || loading || !connected) return;
    
    const prompt = input.trim();
    setInput('');
    setLoading(true);
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    
    try {
      console.log('ChatPanel: Sending request to /api/agent', { prompt, sessionId });
      
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, sheetModel, sessionId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to start analysis');
      }
      
      console.log('ChatPanel: Request sent successfully');
    } catch (error) {
      console.error('ChatPanel: Error submitting request:', error);
      toast.error('Failed to process request');
      setLoading(false);
      // Remove the user message if the request failed
      setMessages(prev => prev.slice(0, -1));
    }
  };
  
  return (
    <div className="h-full flex flex-col p-4">
      <h2 className="text-lg font-semibold mb-4">Chat</h2>
      
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <Card className={`max-w-[80%] p-3 ${msg.role === 'user' ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <div className="prose prose-sm max-w-none">
                <div dangerouslySetInnerHTML={{ __html: msg.content }} />
              </div>
              {msg.data?.tableJson && (
                <div className="mt-2 text-xs text-gray-500">
                  📊 Table data available
                </div>
              )}
            </Card>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <Card className="p-3 bg-gray-50">
              <div className="flex items-center space-x-2">
                <div className="animate-pulse">Analyzing...</div>
              </div>
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {!connected && (
        <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-600">
          <div className="flex items-center gap-2">
            <div className="animate-pulse">●</div>
            Establishing secure connection...
          </div>
        </div>
      )}
      
      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={connected ? "Ask about your data..." : "Waiting for connection..."}
          className="resize-none"
          rows={3}
          disabled={!connected}
        />
        <Button 
          onClick={handleSubmit} 
          disabled={loading || !input.trim() || !connected}
          size="icon"
          title={!connected ? "Waiting for connection..." : "Send message"}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}