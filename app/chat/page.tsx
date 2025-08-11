'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SheetModel } from '@/lib/types';
import SpreadsheetCanvas from './components/SpreadsheetCanvas';
import ChatPanel from './components/ChatPanel';
import ThoughtConsole from './components/ThoughtConsole';
import { EventProvider } from './components/EventContext';

export default function ChatPage() {
  const [sheetModel, setSheetModel] = useState<SheetModel | null>(null);
  const [highlightRange, setHighlightRange] = useState<{ sheetId: string; range: string } | null>(null);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
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
      <div className="h-screen flex flex-col">
        {/* Top section with spreadsheet - reduced height */}
        <div className="h-48 border-b bg-gray-50">
          <SpreadsheetCanvas 
            sheetModel={sheetModel} 
            highlightRange={highlightRange}
          />
        </div>
        
        {/* Bottom section with chat and logs side by side */}
        <div className="flex-1 flex">
          <div className="flex-1 border-r">
            <ChatPanel 
              sheetModel={sheetModel}
              onHighlight={setHighlightRange}
              sessionId={sessionId}
            />
          </div>
          <div className="w-96">
            <ThoughtConsole sessionId={sessionId} />
          </div>
        </div>
      </div>
    </EventProvider>
  );
}