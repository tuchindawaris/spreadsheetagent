'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SheetModel } from '@/lib/types';
import SpreadsheetCanvas from './components/SpreadsheetCanvas';
import ChatPanel from './components/ChatPanel';
import ThoughtConsole from './components/ThoughtConsole';

export default function ChatPage() {
  const [sheetModel, setSheetModel] = useState<SheetModel | null>(null);
  const [highlightRange, setHighlightRange] = useState<{ sheetId: string; range: string } | null>(null);
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
    <div className="h-screen flex flex-col">
      <div className="flex-1 flex">
        <div className="flex-1 p-4">
          <SpreadsheetCanvas 
            sheetModel={sheetModel} 
            highlightRange={highlightRange}
          />
        </div>
        <div className="w-96 border-l">
          <ChatPanel 
            sheetModel={sheetModel}
            onHighlight={setHighlightRange}
          />
        </div>
      </div>
      <ThoughtConsole />
    </div>
  );
}