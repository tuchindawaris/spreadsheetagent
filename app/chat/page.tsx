'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SheetModel } from '@/lib/types';
import SpreadsheetViewer from './components/SpreadsheetViewer';
import ChatInterface from './components/ChatInterface';
import ThoughtStream from './components/ThoughtStream';
import { EventProvider } from './components/EventContext';
import { Card } from '@/components/ui/card';

export default function ChatPage() {
  const [sheetModel, setSheetModel] = useState<SheetModel | null>(null);
  const [highlightRange, setHighlightRange] = useState<{ sheetId: string; range: string } | null>(null);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const [showThoughts, setShowThoughts] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    // Load sheet model from session storage
    const stored = sessionStorage.getItem('sheetModel');
    if (!stored) {
      router.push('/upload');
      return;
    }
    
    setSheetModel(JSON.parse(stored));
  }, [router]);
  
  if (!sheetModel) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  return (
    <EventProvider sessionId={sessionId}>
      <div className="h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Spreadsheet Analysis</h1>
          <button
            onClick={() => setShowThoughts(!showThoughts)}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {showThoughts ? 'Hide' : 'Show'} Agent Log
          </button>
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side - Chat */}
          <div className="w-96 bg-white border-r flex flex-col">
            <ChatInterface 
              sheetModel={sheetModel}
              onHighlight={setHighlightRange}
              sessionId={sessionId}
            />
          </div>
          
          {/* Center - Data Viewer */}
          <div className="flex-1 p-8 overflow-auto">
            <div className="max-w-6xl mx-auto">
              <SpreadsheetViewer 
                sheetModel={sheetModel} 
                highlightRange={highlightRange}
              />
            </div>
          </div>
          
          {/* Right Side - Thought Stream (collapsible) */}
          {showThoughts && (
            <div className="w-80 bg-white border-l">
              <ThoughtStream sessionId={sessionId} />
            </div>
          )}
        </div>
      </div>
    </EventProvider>
  );
}