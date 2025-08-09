// app/chat/components/ChatInterface.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SheetModel, AgentEvent, AnswerPayload } from '@/lib/types';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEvents } from './EventContext';
import DataDisplay from './DataDisplay';

interface Props {
  sheetModel: SheetModel;
  onHighlight: (range: { sheetId: string; range: string } | null) => void;
  sessionId: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  analysisContext?: any;
  timestamp: Date;
}

export default function ChatInterface({ sheetModel, onHighlight, sessionId }: Props) {
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
            data: event.content.data,
            analysisContext: event.content.analysisContext,
            timestamp: new Date()
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
    
    // Validate sheetModel before sending
    if (!sheetModel || !sheetModel.sheets || sheetModel.sheets.length === 0) {
      toast.error('No spreadsheet data available');
      return;
    }
    
    const prompt = input.trim();
    setInput('');
    setLoading(true);
    
    // Add user message
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: prompt,
      timestamp: new Date()
    }]);
    
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
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Chat Assistant</h2>
        <p className="text-sm text-gray-600">Ask questions about your data</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Ready to analyze your spreadsheet!</p>
            <p className="text-sm text-gray-500 mt-2">
              Try asking about totals, averages, or specific data points.
            </p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className="animate-in fade-in">
            {msg.role === 'user' ? (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-1">You</div>
                  <div className="bg-blue-50 rounded-lg p-3 text-sm">
                    {msg.content}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-1">Assistant</div>
                  {msg.data !== undefined ? (
                    <DataDisplay data={msg.data} analysisContext={msg.analysisContext} />
                  ) : msg.content ? (
                    <div className="bg-gray-50 rounded-lg p-3 text-sm">
                      {msg.content}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        ))}
        
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Bot className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm text-gray-600 mb-1">Assistant</div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-gray-600">Analyzing your data...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t">
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
            placeholder={connected ? "Ask about your data..." : "Connecting..."}
            className="resize-none"
            rows={2}
            disabled={!connected}
          />
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !input.trim() || !connected}
            size="icon"
            className="h-auto"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {connected ? 'Connected' : 'Connecting...'} • Press Enter to send
        </div>
      </div>
    </div>
  );
}