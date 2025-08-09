'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Table, BarChart3 } from 'lucide-react';

interface Props {
  data: any;
  analysisContext?: {
    accessedColumns: string[];
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
  
  // Check if data is an array of objects (table format)
  const isArrayOfObjects = Array.isArray(data) && data.length > 0 && typeof data[0] === 'object';
  
  // Check if data is a single object (key-value format)
  const isKeyValueObject = !Array.isArray(data) && typeof data === 'object';
  
  let tableData: Array<{ key: string; value: any }> = [];
  let columns: string[] = [];
  let rows: any[] = [];
  let isKeyValueFormat = false;
  
  // Determine column headers based on context
  let keyColumnHeader = 'Key';
  let valueColumnHeader = 'Value';
  
  if (analysisContext && analysisContext.accessedColumns.length > 0) {
    const mainColumn = analysisContext.accessedColumns[0];
    const operation = analysisContext.operation || 'analysis';
    
    switch (operation) {
      case 'groupBy':
        keyColumnHeader = mainColumn;
        valueColumnHeader = analysisContext.accessedColumns[1] || 'Count';
        break;
      case 'count':
        keyColumnHeader = mainColumn;
        valueColumnHeader = 'Count';
        break;
      case 'sum':
        keyColumnHeader = analysisContext.accessedColumns.length > 1 ? analysisContext.accessedColumns[0] : 'Category';
        valueColumnHeader = `Sum of ${analysisContext.accessedColumns[analysisContext.accessedColumns.length - 1]}`;
        break;
      case 'average':
        keyColumnHeader = analysisContext.accessedColumns.length > 1 ? analysisContext.accessedColumns[0] : 'Category';
        valueColumnHeader = `Average ${analysisContext.accessedColumns[analysisContext.accessedColumns.length - 1]}`;
        break;
      default:
        if (analysisContext.accessedColumns.length === 1) {
          keyColumnHeader = 'Index';
          valueColumnHeader = mainColumn;
        } else if (analysisContext.accessedColumns.length >= 2) {
          keyColumnHeader = analysisContext.accessedColumns[0];
          valueColumnHeader = analysisContext.accessedColumns[1];
        }
    }
  }
  
  if (isKeyValueObject) {
    // Convert object to key-value pairs
    isKeyValueFormat = true;
    tableData = Object.entries(data).map(([key, value]) => ({
      key,
      value
    }));
  } else if (isArrayOfObjects) {
    // Use existing table format
    columns = Object.keys(data[0]);
    rows = data;
  } else if (Array.isArray(data)) {
    // Handle array of primitives
    isKeyValueFormat = true;
    tableData = data.map((item, index) => ({
      key: `Item ${index + 1}`,
      value: item
    }));
    
    // For array of primitives, adjust headers
    if (analysisContext && analysisContext.accessedColumns.length > 0) {
      keyColumnHeader = 'Index';
      valueColumnHeader = analysisContext.accessedColumns[0];
    }
  } else {
    // Handle single primitive value
    isKeyValueFormat = true;
    tableData = [{ key: 'Result', value: data }];
    
    // For single values, use operation-specific headers
    if (analysisContext) {
      keyColumnHeader = 'Calculation';
      if (analysisContext.operation === 'sum' && analysisContext.accessedColumns.length > 0) {
        valueColumnHeader = `Total ${analysisContext.accessedColumns[0]}`;
      } else if (analysisContext.operation === 'count') {
        valueColumnHeader = 'Count';
      } else if (analysisContext.operation === 'average' && analysisContext.accessedColumns.length > 0) {
        valueColumnHeader = `Average ${analysisContext.accessedColumns[0]}`;
      }
    }
  }
  
  // Apply truncation
  const displayData = isKeyValueFormat ? tableData : rows;
  const truncatedData = expanded ? displayData : displayData.slice(0, INITIAL_ROWS);
  const hasMore = displayData.length > INITIAL_ROWS;
  
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    } else if (typeof value === 'number') {
      // Format numbers with commas and limit decimals
      if (Number.isInteger(value)) {
        return value.toLocaleString();
      } else {
        return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
      }
    } else if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    } else {
      return String(value);
    }
  };
  
  // Detect if this is chart-worthy data
  const isChartable = isKeyValueFormat && 
    tableData.length > 1 && 
    tableData.length < 20 &&
    tableData.every(item => typeof item.value === 'number');
  
  return (
    <Card className="overflow-hidden bg-white">
      {/* Header */}
      <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Table className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            {analysisContext?.intent || 'Results'}
          </span>
        </div>
        {isChartable && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <BarChart3 className="h-3 w-3" />
            <span>Chart available</span>
          </div>
        )}
      </div>
      
      {/* Data Table */}
      <div className="overflow-x-auto overflow-y-auto max-h-80">
        <table className="text-sm">
          {isKeyValueFormat ? (
            <>
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap min-w-[150px]">
                    {keyColumnHeader}
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap">
                    {valueColumnHeader}
                  </th>
                </tr>
              </thead>
              <tbody>
                {truncatedData.map((row: any, rowIdx) => (
                  <tr key={rowIdx} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-600 whitespace-nowrap">
                      {row.key}
                    </td>
                    <td className="px-4 py-2 font-mono text-sm whitespace-nowrap">
                      {formatValue(row.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <>
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>
                  {columns.map((col, idx) => (
                    <th key={idx} className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {truncatedData.map((row: any, rowIdx) => (
                  <tr key={rowIdx} className="border-b hover:bg-gray-50">
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} className="px-4 py-2 whitespace-nowrap">
                        <div className="max-w-xs overflow-hidden text-ellipsis">
                          {formatValue(row[col])}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>
      
      {/* Footer */}
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