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
    
    setLoading(true);
    
    try {
      const sheetModel = await parseSheetToModel(file);
      
      // Store in session storage for MVP (no persistence)
      sessionStorage.setItem('sheetModel', JSON.stringify(sheetModel));
      
      toast.success(`Loaded ${sheetModel.tables.length} sheet(s)`);
      router.push('/chat');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to parse file');
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