'use client';

import { useEffect, useRef, useState } from 'react';
import { SheetModel, Table } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSpreadsheet, Table as TableIcon, ChevronRight, MoveHorizontal } from 'lucide-react';

interface Props {
  sheetModel: SheetModel;
  highlightRange: { sheetId: string; range: string } | null;
}

export default function SpreadsheetViewer({ sheetModel, highlightRange }: Props) {
  const [activeTable, setActiveTable] = useState(sheetModel.tables[0]?.name || '');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  // Group tables by base sheet name
  const groupedTables = sheetModel.tables.reduce((acc, table) => {
    const baseName = table.name.split('_')[0];
    if (!acc[baseName]) acc[baseName] = [];
    acc[baseName].push(table);
    return acc;
  }, {} as Record<string, Table[]>);
  
  // Auto-expand groups on mount
  useEffect(() => {
    setExpandedGroups(new Set(Object.keys(groupedTables)));
  }, []);
  
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
  
  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };
  
  const renderTable = (table: Table) => {
    const isActive = table.name === activeTable;
    const hasHighlight = highlightRange?.sheetId === table.name;
    
    return (
      <div className={`transition-all ${isActive ? 'block' : 'hidden'}`}>
        <div className="border rounded-lg overflow-hidden">
          {/* Wrapper for both scrolls */}
          <div ref={tableContainerRef} className="overflow-auto max-h-[500px]">
            <table className="text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {table.columns.map((col, idx) => (
                    <th 
                      key={idx} 
                      className="px-4 py-2 text-left font-medium text-gray-700 border-b border-r last:border-r-0 whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <span>{col.name}</span>
                        <span className="text-xs text-gray-400">
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
                      const cellId = `${rowIdx}-${colIdx}`;
                      const shouldHighlight = hasHighlight && isWithinRange(
                        highlightRange!.range,
                        rowIdx,
                        colIdx,
                        table
                      );
                      
                      return (
                        <td 
                          key={colIdx} 
                          className={`px-4 py-2 border-r last:border-r-0 whitespace-nowrap ${
                            shouldHighlight ? 'bg-yellow-200 animate-pulse' : ''
                          }`}
                        >
                          <div className="max-w-xs overflow-hidden text-ellipsis">
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
            <div className="p-2 bg-gray-50 text-center text-sm text-gray-600 border-t sticky bottom-0">
              Showing first 100 of {table.rows.length} rows
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <Card className="shadow-lg">
      <div className="flex h-[600px]">
        {/* Left Sidebar - Table Navigation */}
        <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Data Tables</h3>
          <div className="space-y-2">
            {Object.entries(groupedTables).map(([baseName, tables]) => (
              <div key={baseName}>
                {tables.length === 1 ? (
                  // Single table - simple button
                  <button
                    onClick={() => setActiveTable(tables[0].name)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                      activeTable === tables[0].name
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <TableIcon className="h-4 w-4" />
                    {baseName}
                    <span className="ml-auto text-xs text-gray-500">
                      {tables[0].rows.length} rows
                    </span>
                  </button>
                ) : (
                  // Multiple tables - expandable group
                  <div>
                    <button
                      onClick={() => toggleGroup(baseName)}
                      className="w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-gray-100"
                    >
                      <ChevronRight 
                        className={`h-4 w-4 transition-transform ${
                          expandedGroups.has(baseName) ? 'rotate-90' : ''
                        }`}
                      />
                      <FileSpreadsheet className="h-4 w-4" />
                      {baseName}
                      <span className="ml-auto text-xs text-gray-500">
                        {tables.length} tables
                      </span>
                    </button>
                    {expandedGroups.has(baseName) && (
                      <div className="ml-6 mt-1 space-y-1">
                        {tables.map(table => {
                          const displayName = table.name.replace(baseName + '_', '');
                          return (
                            <button
                              key={table.name}
                              onClick={() => setActiveTable(table.name)}
                              className={`w-full text-left px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                                activeTable === table.name
                                  ? 'bg-blue-100 text-blue-700 font-medium'
                                  : 'hover:bg-gray-100'
                              }`}
                            >
                              <TableIcon className="h-3 w-3" />
                              {displayName}
                              <span className="ml-auto text-xs text-gray-500">
                                {table.rows.length}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Right Content - Table Display */}
        <div className="flex-1 p-6 overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                {activeTable}
              </h2>
              <p className="text-sm text-gray-600">
                {sheetModel.tables.find(t => t.name === activeTable)?.columns.length} columns,{' '}
                {sheetModel.tables.find(t => t.name === activeTable)?.rows.length} rows
              </p>
            </div>
            {hasHorizontalScroll && (
              <div className="text-xs text-gray-500 flex items-center gap-1 animate-pulse">
                <MoveHorizontal className="h-3 w-3" />
                <span>Scroll to see all columns</span>
              </div>
            )}
          </div>
          
          {sheetModel.tables.map(table => renderTable(table))}
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