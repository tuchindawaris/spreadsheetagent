// app/chat/components/SpreadsheetViewer.tsx
'use client';

import { useEffect, useState } from 'react';
import { SheetModel } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { FileSpreadsheet } from 'lucide-react';

interface Props {
  sheetModel: SheetModel;
  highlightRange: { sheetId: string; range: string } | null;
}

export default function SpreadsheetViewer({ sheetModel, highlightRange }: Props) {
  const [activeSheet, setActiveSheet] = useState<string>('');
  
  // Handle case where sheetModel is invalid
  if (!sheetModel || !sheetModel.sheets || sheetModel.sheets.length === 0) {
    return (
      <Card className="shadow-lg h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No spreadsheet data available</p>
        </div>
      </Card>
    );
  }
  
  useEffect(() => {
    if (!activeSheet && sheetModel.sheets.length > 0) {
      setActiveSheet(sheetModel.sheets[0].name);
    }
  }, [sheetModel, activeSheet]);
  
  // Handle highlighting - switch to the appropriate sheet
  useEffect(() => {
    if (highlightRange) {
      const sheet = sheetModel.sheets.find(s => s.name === highlightRange.sheetId);
      if (sheet) {
        setActiveSheet(sheet.name);
      }
    }
  }, [highlightRange, sheetModel]);
  
  const parseRange = (range: string) => {
    const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!match) return null;
    
    const colToIndex = (col: string) => {
      let index = 0;
      for (let i = 0; i < col.length; i++) {
        index = index * 26 + (col.charCodeAt(i) - 65) + 1;
      }
      return index - 1;
    };
    
    return {
      startCol: colToIndex(match[1]),
      startRow: parseInt(match[2]) - 1,
      endCol: colToIndex(match[3]),
      endRow: parseInt(match[4]) - 1
    };
  };
  
  const isCellHighlighted = (rowIdx: number, colIdx: number, sheetName: string) => {
    if (!highlightRange || highlightRange.sheetId !== sheetName) return false;
    const range = parseRange(highlightRange.range);
    if (!range) return false;
    
    return rowIdx >= range.startRow && rowIdx <= range.endRow &&
           colIdx >= range.startCol && colIdx <= range.endCol;
  };
  
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return String(value);
  };
  
  const renderSheet = (sheet: any) => {
    const isActive = sheet.name === activeSheet;
    const maxDisplayRows = 100;
    
    // Handle case where sheet.data might be undefined
    if (!sheet.data || !Array.isArray(sheet.data)) {
      return (
        <div
          key={sheet.name}
          className={`h-full overflow-auto p-4 ${isActive ? 'block' : 'hidden'}`}
        >
          <Card className="p-8 text-center text-gray-500">
            <p>No data available in this sheet</p>
          </Card>
        </div>
      );
    }
    
    const displayData = sheet.data.slice(0, maxDisplayRows);
    
    return (
      <div
        key={sheet.name}
        className={`h-full overflow-auto ${isActive ? 'block' : 'hidden'}`}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet className="h-5 w-5 text-gray-600" />
            <h2 className="text-xl font-semibold">{sheet.name}</h2>
            <span className="text-sm text-gray-500">
              ({sheet.dimensions.rows} × {sheet.dimensions.cols})
            </span>
          </div>
          
          <Card className="overflow-hidden">
            <div className="overflow-auto max-h-[600px]">
              <table className="w-full text-sm">
                <tbody>
                  {displayData.map((row: any[], rowIdx: number) => (
                    <tr key={rowIdx} className="border-b hover:bg-gray-50">
                      <td className="px-2 py-1 bg-gray-50 text-gray-600 font-medium text-xs sticky left-0">
                        {rowIdx + 1}
                      </td>
                      {Array.isArray(row) ? row.map((cell, colIdx) => {
                        const isHighlighted = isCellHighlighted(rowIdx, colIdx, sheet.name);
                        return (
                          <td
                            key={colIdx}
                            className={`px-3 py-1.5 border-r ${
                              isHighlighted ? 'bg-yellow-200 animate-pulse' : ''
                            }`}
                          >
                            {formatValue(cell)}
                          </td>
                        );
                      }) : (
                        <td className="px-3 py-1.5 text-gray-500">Invalid row data</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {sheet.data.length > maxDisplayRows && (
              <div className="px-4 py-2 bg-gray-50 border-t text-center">
                <span className="text-xs text-gray-600">
                  Showing first {maxDisplayRows} of {sheet.data.length} rows
                </span>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  };
  
  return (
    <Card className="shadow-lg h-full flex flex-col">
      <div className="flex-1 overflow-hidden">
        {sheetModel.sheets.map(sheet => renderSheet(sheet))}
      </div>
      
      {/* Sheet tabs */}
      <div className="border-t bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {sheetModel.sheets.map(sheet => {
            const isActive = activeSheet === sheet.name;
            return (
              <button
                key={sheet.name}
                onClick={() => setActiveSheet(sheet.name)}
                className={`px-4 py-2 rounded-md text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-white border hover:bg-gray-100 text-gray-700'
                }`}
              >
                <FileSpreadsheet className="h-3 w-3" />
                <span className="font-medium">{sheet.name}</span>
                <span className={`text-xs ${isActive ? 'text-blue-100' : 'text-gray-500'}`}>
                  ({sheet.dimensions.rows}×{sheet.dimensions.cols})
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}