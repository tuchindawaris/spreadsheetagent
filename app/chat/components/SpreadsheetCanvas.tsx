'use client';

import { useEffect, useRef, useState } from 'react';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.css';
import { SheetModel } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Props {
  sheetModel: SheetModel;
  highlightRange: { sheetId: string; range: string } | null;
}

export default function SpreadsheetCanvas({ sheetModel, highlightRange }: Props) {
  const containerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const hotInstances = useRef<{ [key: string]: Handsontable | null }>({});
  const [activeTab, setActiveTab] = useState(sheetModel.tables[0]?.name || '');
  
  useEffect(() => {
    // Initialize Handsontable for each sheet
    sheetModel.tables.forEach(table => {
      const container = containerRefs.current[table.name];
      if (!container || hotInstances.current[table.name]) return;
      
      // Prepare data with headers
      const headers = table.columns.map(c => c.name);
      const data = [headers, ...table.rows.map(row => 
        headers.map(h => row[h] ?? '')
      )];
      
      const hot = new Handsontable(container, {
        data,
        readOnly: true,
        stretchH: 'all',
        autoWrapRow: true,
        height: 200, // Fixed height for smaller display
        maxRows: 20, // Limit visible rows
        rowHeaders: true,
        colHeaders: false,
        licenseKey: 'non-commercial-and-evaluation',
      });
      
      hotInstances.current[table.name] = hot;
    });
    
    return () => {
      // Cleanup
      Object.values(hotInstances.current).forEach(hot => hot?.destroy());
      hotInstances.current = {};
    };
  }, [sheetModel]);
  
  useEffect(() => {
    // Handle highlighting
    if (!highlightRange) return;
    
    // Switch to the highlighted sheet first
    setActiveTab(highlightRange.sheetId);
    
    // Wait for tab switch to complete
    setTimeout(() => {
      const hot = hotInstances.current[highlightRange.sheetId];
      if (!hot) return;
      
      // Parse range (e.g., "A1:E10")
      const match = highlightRange.range.match(/([A-Z])(\d+):([A-Z])(\d+)/);
      if (!match) return;
      
      const startCol = match[1].charCodeAt(0) - 65;
      const startRow = parseInt(match[2]) - 1;
      const endCol = match[3].charCodeAt(0) - 65;
      const endRow = parseInt(match[4]) - 1;
      
      // Use Handsontable's selection API
      hot.selectCell(startRow, startCol, endRow, endCol);
      
      // Also add visual highlight with custom class
      const selection = hot.getSelected();
      if (selection) {
        for (let row = startRow; row <= endRow; row++) {
          for (let col = startCol; col <= endCol; col++) {
            const td = hot.getCell(row, col);
            if (td) {
              td.classList.add('highlight-cell');
              // Remove highlight after animation
              setTimeout(() => {
                td.classList.remove('highlight-cell');
              }, 2000);
            }
          }
        }
      }
      
      // Scroll to the selection
      hot.scrollViewportTo(startRow, startCol);
    }, 100);
  }, [highlightRange]);
  
  return (
    <div className="h-full flex flex-col p-2">
      <h2 className="text-sm font-semibold mb-1">Data Preview</h2>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="h-8">
          {sheetModel.tables.map(table => (
            <TabsTrigger key={table.name} value={table.name} className="text-xs">
              {table.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {sheetModel.tables.map(table => (
          <TabsContent key={table.name} value={table.name} className="flex-1">
            <div 
              ref={el => containerRefs.current[table.name] = el}
              className="h-full"
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}