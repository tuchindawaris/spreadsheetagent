// app/chat/components/DataDisplay.tsx
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Table, BarChart3 } from 'lucide-react';

interface Props {
  data: any;
  analysisContext?: {
    accessedRange?: string;
    intent: string;
    operation?: string;
  };
}

export default function DataDisplay({ data, analysisContext }: Props) {
  const [expanded, setExpanded] = useState(false);
  const INITIAL_ROWS = 10;
  
  if (!data) {
    return (
      <Card className="p-4 bg-gray-50">
        <div className="text-sm text-gray-500">No data to display</div>
      </Card>
    );
  }
  
  // Handle different data formats
  const isArray = Array.isArray(data);
  const isObjectArray = isArray && data.length > 0 && typeof data[0] === 'object' && !Array.isArray(data[0]);
  const is2DArray = isArray && data.length > 0 && Array.isArray(data[0]);
  const isObject = !isArray && typeof data === 'object';
  
  let displayData: any[] = [];
  let columns: string[] = [];
  let isKeyValue = false;
  
  if (isObjectArray) {
    // Array of objects - extract columns
    columns = data.length > 0 ? Object.keys(data[0]) : [];
    displayData = data;
  } else if (is2DArray) {
    // 2D array - treat first row as headers
    if (data[0] && Array.isArray(data[0])) {
      columns = data[0].map((_: any, i: number) => `Column ${i + 1}`);
      displayData = data.slice(1).map((row: any[]) => {
        const obj: any = {};
        if (Array.isArray(row)) {
          columns.forEach((col, i) => {
            obj[col] = row[i];
          });
        }
        return obj;
      });
    }
  } else if (isObject) {
    // Key-value object
    isKeyValue = true;
    displayData = Object.entries(data).map(([key, value]) => ({ key, value }));
    columns = ['Key', 'Value'];
  } else if (isArray) {
    // Simple array
    isKeyValue = true;
    displayData = data.map((item, i) => ({ key: `Item ${i + 1}`, value: item }));
    columns = ['Index', 'Value'];
  } else {
    // Single value
    isKeyValue = true;
    displayData = [{ key: 'Result', value: data }];
    columns = ['Type', 'Value'];
  }
  
  // Handle edge cases
  if (!displayData || displayData.length === 0) {
    return (
      <Card className="p-4 bg-gray-50">
        <div className="text-sm text-gray-500">No data to display</div>
      </Card>
    );
  }
  
  const truncatedData = expanded ? displayData : displayData.slice(0, INITIAL_ROWS);
  const hasMore = displayData.length > INITIAL_ROWS;
  
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'number') {
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };
  
  return (
    <Card className="overflow-hidden bg-white">
      <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Table className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            {analysisContext?.intent || 'Results'}
          </span>
        </div>
        {displayData.length > 0 && (
          <span className="text-xs text-gray-500">
            {displayData.length} {displayData.length === 1 ? 'row' : 'rows'}
          </span>
        )}
      </div>
      
      <div className="overflow-x-auto overflow-y-auto max-h-80">
        <table className="text-sm w-full">
          <thead className="bg-gray-50 border-b sticky top-0">
            <tr>
              {columns.length > 0 ? (
                isKeyValue ? (
                  <>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap">
                      {columns[0]}
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap">
                      {columns[1]}
                    </th>
                  </>
                ) : (
                  columns.map((col, idx) => (
                    <th key={idx} className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap">
                      {col}
                    </th>
                  ))
                )
              ) : (
                <th className="px-4 py-2 text-left font-medium text-gray-700">No Headers</th>
              )}
            </tr>
          </thead>
          <tbody>
            {truncatedData.length > 0 ? truncatedData.map((row: any, rowIdx: number) => (
              <tr key={rowIdx} className="border-b hover:bg-gray-50">
                {isKeyValue ? (
                  <>
                    <td className="px-4 py-2 font-medium text-gray-600">
                      {row.key}
                    </td>
                    <td className="px-4 py-2">
                      {formatValue(row.value)}
                    </td>
                  </>
                ) : (
                  columns.length > 0 ? columns.map((col, colIdx) => (
                    <td key={colIdx} className="px-4 py-2">
                      <div className="max-w-xs overflow-hidden text-ellipsis">
                        {formatValue(row[col])}
                      </div>
                    </td>
                  )) : (
                    <td className="px-4 py-2 text-gray-500">No columns</td>
                  )
                )}
              </tr>
            )) : (
              <tr>
                <td colSpan={columns.length || 1} className="px-4 py-2 text-center text-gray-500">
                  No rows to display
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {hasMore && (
        <div className="p-2 border-t bg-gray-50 flex justify-center">
          <Button
            onClick={() => setExpanded(!expanded)}
            size="sm"
            variant="ghost"
            className="text-xs"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show All ({displayData.length} rows)
              </>
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}