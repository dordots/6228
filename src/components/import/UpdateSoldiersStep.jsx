import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function UpdateSoldiersStep({ 
  status, 
  onUpload, 
  isProcessing 
}) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      onUpload(file);
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'uploaded': return 'border-blue-200 bg-blue-50';
      case 'completed': return 'border-green-200 bg-green-50';
      case 'error': return 'border-red-200 bg-red-50';
      default: return 'border-slate-200 hover:border-slate-300';
    }
  };

  const getStatusIcon = () => {
    if (isProcessing) return <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />;
    
    switch (status.status) {
      case 'uploaded':
        return <CheckCircle className="w-12 h-12 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-12 h-12 text-green-500" />;
      case 'error':
        return <AlertTriangle className="w-12 h-12 text-red-500" />;
      default:
        return <RefreshCw className="w-12 h-12 text-slate-400" />;
    }
  };

  const getStatusBadge = () => {
    const colors = {
      pending: "bg-gray-100 text-gray-800",
      uploaded: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      error: "bg-red-100 text-red-800"
    };
    
    return (
      <Badge className={colors[status.status]}>
        {status.status.toUpperCase()} {status.count > 0 && `(${status.count})`}
      </Badge>
    );
  };

  return (
    <Card className={`transition-all duration-200 ${getStatusColor()}`}>
      <CardHeader className="text-center">
        <div className="flex justify-between items-start mb-4">
          <CardTitle className="text-lg text-left">Update Soldiers File</CardTitle>
          {getStatusBadge()}
        </div>
        <div className="flex justify-center mb-4">
          {getStatusIcon()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-600">
          <p className="font-medium mb-2">File Column Guide:</p>
          <ul className="space-y-1 text-xs">
            <li><strong>soldier_id</strong> - (Required) Must match an existing soldier.</li>
            <li><strong>first_name, last_name, email, street_address, city, phone_number, etc.</strong> - (Optional) Include any columns for details you want to update.</li>
          </ul>
        </div>

        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            {status.status === 'pending' ? 'Upload File (CSV/XLSX)' : 'Replace File'}
          </Button>
          
          {status.status === 'uploaded' && (
            <div className="text-center">
              <p className="text-sm text-blue-600 font-medium">
                Ready to update from {status.count} records
              </p>
            </div>
          )}
          
          {status.status === 'completed' && (
            <div className="text-center space-y-1">
              <p className="text-sm text-green-600 font-medium">
                ✓ Updated {status.updated} soldiers
              </p>
              {status.notFound > 0 && (
                <p className="text-xs text-amber-600">
                  {status.notFound} soldier IDs not found
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}