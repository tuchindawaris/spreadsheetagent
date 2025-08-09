// app/chat/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SheetModel } from '@/lib/types';
import SpreadsheetViewer from './components/SpreadsheetViewer';
import ChatInterface from './components/ChatInterface';
import ThoughtStream from './components/ThoughtStream';
import { EventProvider } from './components/EventContext';

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
    
    try {
      const parsed = JSON.parse(stored);
      
      // Validate the sheet model structure
      if (!parsed || !parsed.sheets || !Array.isArray(parsed.sheets)) {
        throw new Error('Invalid sheet model format');
      }
      
      if (parsed.sheets.length === 0) {
        throw new Error('No sheets found in model');
      }
      
      // Validate each sheet has required properties
      for (const sheet of parsed.sheets) {
        if (!sheet.name || !sheet.data || !Array.isArray(sheet.data)) {
          throw new Error(`Invalid sheet structure for sheet: ${sheet.name || 'unnamed'}`);
        }
      }
      
      setSheetModel(parsed);
    } catch (error) {
      console.error('Failed to load sheet model:', error);
      sessionStorage.removeItem('sheetModel');
      router.push('/upload');
    }
  }, [router]);
  
  if (!sheetModel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading spreadsheet...</p>
        </div>
      </div>
    );
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
          <div className="flex-1 p-8 overflow-hidden">
            <div className="h-full max-w-6xl mx-auto">
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