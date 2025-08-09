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
      
      // Clear previous highlights
      hot.selectCell(0, 0, 0, 0);
      
      // Parse range (supports both "A1:E10" and "A:A" formats)
      const fullColumnMatch = highlightRange.range.match(/^([A-Z])1:([A-Z])(\d+)$/);
      const rangeMatch = highlightRange.range.match(/^([A-Z])(\d+):([A-Z])(\d+)$/);
      
      let startCol, startRow, endCol, endRow;
      
      if (fullColumnMatch) {
        // Full column highlight (e.g., "A1:A100")
        startCol = fullColumnMatch[1].charCodeAt(0) - 65;
        startRow = 0; // Include header
        endCol = fullColumnMatch[2].charCodeAt(0) - 65;
        endRow = parseInt(fullColumnMatch[3]) - 1;
      } else if (rangeMatch) {
        // Specific range (e.g., "A2:C5")
        startCol = rangeMatch[1].charCodeAt(0) - 65;
        startRow = parseInt(rangeMatch[2]) - 1;
        endCol = rangeMatch[3].charCodeAt(0) - 65;
        endRow = parseInt(rangeMatch[4]) - 1;
      } else {
        return;
      }
      
      // Use Handsontable's selection API
      hot.selectCell(startRow, startCol, endRow, endCol);
      
      // Add visual highlight with custom class
      const selection = hot.getSelected();
      if (selection) {
        // Clear all previous highlights first
        const allCells = hot.getPlugin('comments').range;
        const tds = hot.rootElement.querySelectorAll('td');
        tds.forEach(td => td.classList.remove('highlight-cell', 'highlight-cell-strong'));
        
        // Add new highlights
        for (let row = startRow; row <= endRow && row < hot.countRows(); row++) {
          for (let col = startCol; col <= endCol && col < hot.countCols(); col++) {
            const td = hot.getCell(row, col);
            if (td) {
              td.classList.add('highlight-cell-strong');
              // Remove highlight after animation
              setTimeout(() => {
                td.classList.remove('highlight-cell-strong');
                td.classList.add('highlight-cell');
              }, 2000);
            }
          }
        }
      }
      
      // Scroll to the selection
      hot.scrollViewportTo(Math.max(0, startRow - 2), startCol);
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