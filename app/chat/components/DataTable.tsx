'use client';

import { Card } from '@/components/ui/card';

interface Props {
  data: any[];
}

export default function DataTable({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-sm text-gray-500">No data to display</div>
      </Card>
    );
  }
  
  // Get column headers from first row
  const columns = Object.keys(data[0]);
  
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b sticky top-0">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className="px-3 py-1.5 text-left font-medium text-gray-700">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b hover:bg-gray-50">
                {columns.map((col, colIdx) => {
                  const value = row[col];
                  let displayValue = '-';
                  
                  if (value !== null && value !== undefined) {
                    if (typeof value === 'number') {
                      // Format numbers with commas
                      displayValue = value.toLocaleString();
                    } else {
                      displayValue = String(value);
                    }
                  }
                  
                  return (
                    <td key={colIdx} className="px-3 py-1.5">
                      {displayValue}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}