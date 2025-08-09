'use client';

import { useEffect, useState } from 'react';
import { SheetModel, Table } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { FileSpreadsheet, Table as TableIcon } from 'lucide-react';
import DataDisplay from './DataDisplay';

interface Props {
  sheetModel: SheetModel;
  highlightRange: { sheetId: string; range: string } | null;
}

export default function SpreadsheetViewer({ sheetModel, highlightRange }: Props) {
  const [activeSheet, setActiveSheet] = useState<string>('');
  
  // Group tables by their base sheet name
  const sheetGroups = sheetModel.tables.reduce((acc, table) => {
    const sheetName = table.name.split('_')[0];
    if (!acc[sheetName]) acc[sheetName] = [];
    acc[sheetName].push(table);
    return acc;
  }, {} as Record<string, Table[]>);
  
  // Initialize active sheet
  useEffect(() => {
    if (!activeSheet && Object.keys(sheetGroups).length > 0) {
      setActiveSheet(Object.keys(sheetGroups)[0]);
    }
  }, [sheetGroups, activeSheet]);
  
  // Handle highlighting - switch to the appropriate sheet
  useEffect(() => {
    if (highlightRange) {
      // Find which sheet contains this table
      const targetSheet = Object.entries(sheetGroups).find(([_, tables]) =>
        tables.some(table => table.name === highlightRange.sheetId)
      );
      if (targetSheet) {
        setActiveSheet(targetSheet[0]);
      }
    }
  }, [highlightRange, sheetGroups]);
  
  const renderSheet = (sheetName: string, tables: Table[]) => {
    const isActive = sheetName === activeSheet;
    
    return (
      <div
        key={sheetName}
        className={`h-full overflow-y-auto ${isActive ? 'block' : 'hidden'}`}
      >
        <div className="p-6 space-y-6">
          {/* Sheet Header */}
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet className="h-5 w-5 text-gray-600" />
            <h2 className="text-xl font-semibold">Sheet: {sheetName}</h2>
            <span className="text-sm text-gray-500">
              ({tables.length} {tables.length === 1 ? 'table' : 'tables'})
            </span>
          </div>
          
          {/* Tables Stack */}
          {tables.map((table, idx) => {
            const isHighlighted = highlightRange?.sheetId === table.name;
            const tableSuffix = table.name.replace(`${sheetName}_`, '');
            const displayName = tableSuffix === sheetName ? 'Main Table' : tableSuffix;
            
            return (
              <div
                key={table.name}
                className={`transition-all ${
                  isHighlighted ? 'ring-2 ring-blue-500 rounded-lg' : ''
                }`}
              >
                <Card className="overflow-hidden">
                  {/* Table Header */}
                  <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TableIcon className="h-4 w-4 text-gray-500" />
                      <h3 className="text-sm font-medium text-gray-700">
                        {displayName}
                      </h3>
                      <span className="text-xs text-gray-500">
                        ({table.columns.length} cols × {table.rows.length} rows)
                      </span>
                    </div>
                  </div>
                  
                  {/* Table Data */}
                  <DataDisplay
                    data={table.rows.slice(0, 10)}
                    columns={table.columns}
                    fullRowCount={table.rows.length}
                    highlightRange={isHighlighted ? highlightRange : null}
                    tableName={table.name}
                  />
                  
                  {/* Show More Indicator */}
                  {table.rows.length > 10 && (
                    <div className="px-4 py-2 bg-gray-50 border-t text-center">
                      <span className="text-xs text-gray-600">
                        Showing first 10 of {table.rows.length} rows
                      </span>
                    </div>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  return (
    <Card className="shadow-lg h-full flex flex-col">
      {/* Main content area - scrollable per sheet */}
      <div className="flex-1 overflow-hidden">
        {Object.entries(sheetGroups).map(([sheetName, tables]) => 
          renderSheet(sheetName, tables)
        )}
      </div>
      
      {/* Sheet tabs at the bottom */}
      <div className="border-t bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {Object.entries(sheetGroups).map(([sheetName, tables]) => {
            const isActive = activeSheet === sheetName;
            const tableCount = tables.length;
            const rowCount = tables.reduce((sum, t) => sum + t.rows.length, 0);
            
            return (
              <button
                key={sheetName}
                onClick={() => setActiveSheet(sheetName)}
                className={`px-4 py-2 rounded-md text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-white border hover:bg-gray-100 text-gray-700'
                }`}
              >
                <FileSpreadsheet className="h-3 w-3" />
                <span className="font-medium">{sheetName}</span>
                <span className={`text-xs ${isActive ? 'text-blue-100' : 'text-gray-500'}`}>
                  ({tableCount} {tableCount === 1 ? 'table' : 'tables'}, {rowCount} rows)
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}