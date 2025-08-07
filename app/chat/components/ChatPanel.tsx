'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { SheetModel, AgentEvent, AnswerPayload } from '@/lib/types';
import { Send } from 'lucide-react';
import toast from 'react-hot-toast';

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
  const eventSourceRef = useRef<EventSource | null>(null);
  
  useEffect(() => {
    console.log('ChatPanel: Connecting to SSE stream with session:', sessionId);
    
    // Connect to SSE stream
    const eventSource = new EventSource(`/api/stream?session=${sessionId}`);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      console.log('ChatPanel: SSE connection opened');
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data: AgentEvent = JSON.parse(event.data);
        console.log('ChatPanel: Received event:', data.type);
        
        switch (data.type) {
          case 'connected':
            console.log('ChatPanel: SSE connected successfully');
            break;
          case 'highlight':
            onHighlight({ sheetId: data.sheetId, range: data.range });
            break;
          case 'thought':
            // Thoughts are handled by ThoughtConsole
            break;
          case 'answer':
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: data.content.markdown,
              data: data.content
            }]);
            setLoading(false);
            break;
        }
      } catch (error) {
        console.error('ChatPanel: Error parsing SSE data:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('ChatPanel: SSE error:', error);
      if (eventSource.readyState === EventSource.CLOSED) {
        toast.error('Connection lost');
        setLoading(false);
      }
    };
    
    return () => {
      console.log('ChatPanel: Cleaning up SSE connection');
      eventSource.close();
    };
  }, [sessionId, onHighlight]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSubmit = async () => {
    if (!input.trim() || loading) return;
    
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
          placeholder="Ask about your data..."
          className="resize-none"
          rows={3}
        />
        <Button 
          onClick={handleSubmit} 
          disabled={loading || !input.trim()}
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}