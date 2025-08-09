// app/upload/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { parseSheetToModel } from '@/lib/sheet-to-model';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';

export default function UploadPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    console.log('Selected file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified).toISOString()
    });
    
    // Check file size (limit to 10MB for safety)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File is too large (max 10MB)');
      e.target.value = '';
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('Parsing file:', file.name);
      const sheetModel = await parseSheetToModel(file);
      
      console.log('Parsed sheet model:', {
        sheets: sheetModel.sheets.length,
        sheetDetails: sheetModel.sheets.map(s => ({
          name: s.name,
          rows: s.dimensions?.rows || 0,
          cols: s.dimensions?.cols || 0,
          hasData: s.data && s.data.length > 0
        })),
        totalCells: sheetModel.sheets.reduce((sum, s) => 
          sum + ((s.dimensions?.rows || 0) * (s.dimensions?.cols || 0)), 0
        )
      });
      
      if (sheetModel.sheets.length === 0) {
        throw new Error('No valid sheets found in the file');
      }
      
      // Clear any existing data first
      sessionStorage.removeItem('sheetModel');
      
      // Store in session storage for MVP (no persistence)
      sessionStorage.setItem('sheetModel', JSON.stringify(sheetModel));
      
      toast.success(`Loaded ${sheetModel.sheets.length} sheet(s)`);
      router.push('/chat');
    } catch (error) {
      console.error('File parsing error:', error);
      
      // Provide specific error messages
      let errorMessage = 'Failed to parse file';
      if (error instanceof Error) {
        if (error.message.includes('20,000 cell limit')) {
          errorMessage = 'File is too large (exceeds 20,000 cell limit)';
        } else if (error.message.includes('No valid data')) {
          errorMessage = 'No valid data found in the spreadsheet';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
      
      // Reset the file input
      e.target.value = '';
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Upload Spreadsheet</CardTitle>
          <CardDescription>
            Select an Excel file (.xlsx) to analyze with AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label htmlFor="file-upload" className="w-full">
                <div className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <Upload className="w-10 h-10 mb-3 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span>
                  </p>
                  <p className="text-xs text-gray-500">Excel files only (max 20k cells)</p>
                </div>
                <Input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  disabled={loading}
                />
              </label>
            </div>
            
            {loading && (
              <div className="text-center text-sm text-gray-500">
                Processing file...
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}