'use client';

import { useEffect, useRef, useState } from 'react';
import { SheetModel, Table } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { FileSpreadsheet, Table as TableIcon, ChevronRight, MoveHorizontal } from 'lucide-react';

interface Props {
  sheetModel: SheetModel;
  highlightRange: { sheetId: string; range: string } | null;
}

export default function SpreadsheetViewer({ sheetModel, highlightRange }: Props) {
  const [activeTable, setActiveTable] = useState(sheetModel.tables[0]?.name || '');
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  // Group tables by base sheet name
  const groupedTables = sheetModel.tables.reduce((acc, table) => {
    const baseName = table.name.split('_')[0];
    if (!acc[baseName]) acc[baseName] = [];
    acc[baseName].push(table);
    return acc;
  }, {} as Record<string, Table[]>);
  
  // Handle highlighting
  useEffect(() => {
    if (highlightRange) {
      setActiveTable(highlightRange.sheetId);
    }
  }, [highlightRange]);
  
  // Check for horizontal scroll when table changes
  useEffect(() => {
    const checkScroll = () => {
      if (tableContainerRef.current) {
        const { scrollWidth, clientWidth } = tableContainerRef.current;
        setHasHorizontalScroll(scrollWidth > clientWidth);
      }
    };
    
    // Check after a short delay to ensure DOM is updated
    setTimeout(checkScroll, 100);
  }, [activeTable]);
  
  const renderTable = (table: Table) => {
    const isActive = table.name === activeTable;
    const hasHighlight = highlightRange?.sheetId === table.name;
    
    return (
      <div className={`transition-all ${isActive ? 'block' : 'hidden'}`}>
        <div className="border rounded-lg overflow-hidden bg-white">
          {/* Table header info */}
          <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TableIcon className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">{table.name}</span>
              <span className="text-xs text-gray-500">
                ({table.columns.length} cols × {table.rows.length} rows)
              </span>
            </div>
            {hasHorizontalScroll && (
              <div className="text-xs text-gray-500 flex items-center gap-1 animate-pulse">
                <MoveHorizontal className="h-3 w-3" />
                <span>Scroll horizontally</span>
              </div>
            )}
          </div>
          
          {/* Table content */}
          <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[500px] relative">
            <table className="text-sm min-w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {table.columns.map((col, idx) => (
                    <th 
                      key={idx} 
                      className="px-4 py-2 text-left font-medium text-gray-700 border-b border-r last:border-r-0 whitespace-nowrap max-w-[200px]"
                    >
                      <div className="flex items-center gap-2 max-w-[200px]">
                        <span className="truncate">{col.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {col.type === 'number' && '#'}
                          {col.type === 'date' && '📅'}
                          {col.type === 'string' && 'Aa'}
                          {col.type === 'mixed' && '○'}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.slice(0, 100).map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-gray-50 border-b">
                    {table.columns.map((col, colIdx) => {
                      const value = row[col.name];
                      const shouldHighlight = hasHighlight && isWithinRange(
                        highlightRange!.range,
                        rowIdx,
                        colIdx,
                        table
                      );
                      
                      return (
                        <td 
                          key={colIdx} 
                          className={`px-4 py-2 border-r last:border-r-0 whitespace-nowrap max-w-[200px] ${
                            shouldHighlight ? 'bg-yellow-200 animate-pulse' : ''
                          }`}
                        >
                          <div className="max-w-[200px] overflow-hidden text-ellipsis">
                            {formatCellValue(value, col.type)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {table.rows.length > 100 && (
            <div className="p-2 bg-gray-50 text-center text-sm text-gray-600 border-t">
              Showing first 100 of {table.rows.length} rows
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <Card className="shadow-lg h-full flex flex-col">
      {/* Main content area */}
      <div className="flex-1 p-6 overflow-hidden">
        {sheetModel.tables.map(table => renderTable(table))}
      </div>
      
      {/* Bottom tab navigation */}
      <div className="border-t bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {Object.entries(groupedTables).map(([baseName, tables]) => {
            if (tables.length === 1) {
              const table = tables[0];
              const isActive = activeTable === table.name;
              return (
                <button
                  key={table.name}
                  onClick={() => setActiveTable(table.name)}
                  className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
                    isActive
                      ? 'bg-blue-500 text-white'
                      : 'bg-white border hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <TableIcon className="h-3 w-3" />
                  {baseName}
                  <span className={`text-xs ${isActive ? 'text-blue-100' : 'text-gray-500'}`}>
                    ({table.rows.length})
                  </span>
                </button>
              );
            } else {
              // For grouped tables, show a dropdown-style button
              return (
                <div key={baseName} className="relative inline-block">
                  <div className="flex gap-1">
                    {tables.map(table => {
                      const isActive = activeTable === table.name;
                      const displayName = table.name.replace(baseName + '_', '');
                      return (
                        <button
                          key={table.name}
                          onClick={() => setActiveTable(table.name)}
                          className={`px-2 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors ${
                            isActive
                              ? 'bg-blue-500 text-white'
                              : 'bg-white border hover:bg-gray-100 text-gray-700'
                          }`}
                          title={table.name}
                        >
                          {displayName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>
    </Card>
  );
}

function formatCellValue(value: any, type: string): string {
  if (value === null || value === undefined) return '-';
  
  if (type === 'number' && typeof value === 'number') {
    return value.toLocaleString();
  }
  
  if (type === 'date' && value instanceof Date) {
    return value.toLocaleDateString();
  }
  
  return String(value);
}

function isWithinRange(
  range: string,
  rowIdx: number,
  colIdx: number,
  table: Table
): boolean {
  // Simple range parsing - can be enhanced
  const rangeMatch = range.match(/^([A-Z])(\d+):([A-Z])(\d+)$/);
  if (!rangeMatch) return false;
  
  const startCol = rangeMatch[1].charCodeAt(0) - 65;
  const startRow = parseInt(rangeMatch[2]) - 2; // -1 for 0-index, -1 for header
  const endCol = rangeMatch[3].charCodeAt(0) - 65;
  const endRow = parseInt(rangeMatch[4]) - 2;
  
  return rowIdx >= startRow && rowIdx <= endRow && 
         colIdx >= startCol && colIdx <= endCol;
}