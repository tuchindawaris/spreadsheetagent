'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { SheetModel, AgentEvent, AnswerPayload } from '@/lib/types';
import { Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEvents } from './EventContext';
import DataTable from './DataTable';

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
  
  useEffect(() => {
    const unsubscribe = subscribe((event: AgentEvent) => {
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
    
    return unsubscribe;
  }, [subscribe, onHighlight]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSubmit = async () => {
    if (!input.trim() || loading || !connected) return;
    
    const prompt = input.trim();
    setInput('');
    setLoading(true);
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, sheetModel, sessionId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to start analysis');
      }
    } catch (error) {
      toast.error('Failed to process request');
      setLoading(false);
      setMessages(prev => prev.slice(0, -1));
    }
  };
  
  return (
    <div className="h-full flex flex-col p-4">
      <h2 className="text-lg font-semibold mb-4">Chat</h2>
      
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, idx) => (
          <div key={idx}>
            {msg.role === 'user' ? (
              <div className="flex justify-end mb-2">
                <Card className="max-w-[80%] p-3 bg-blue-50">
                  <div className="text-sm">{msg.content}</div>
                </Card>
              </div>
            ) : (
              <div className="mb-2">
                {msg.data?.tableJson !== undefined ? (
                  <DataTable data={msg.data.tableJson} analysisContext={msg.data.analysisContext} />
                ) : msg.content ? (
                  <Card className="max-w-[80%] p-3">
                    <div className="text-sm">{msg.content}</div>
                  </Card>
                ) : null}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-center">
            <div className="text-sm text-gray-500 animate-pulse">Analyzing...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
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
          rows={2}
          disabled={!connected}
        />
        <Button 
          onClick={handleSubmit} 
          disabled={loading || !input.trim() || !connected}
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}