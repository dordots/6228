import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ImportStep({ 
  title, 
  description, 
  fileType, 
  status, 
  onUpload, 
  isProcessing 
}) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      onUpload(fileType, file);
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
    if (isProcessing) return <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />;
    
    switch (status.status) {
      case 'uploaded':
      case 'completed':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'error':
        return <AlertTriangle className="w-8 h-8 text-red-500" />;
      default:
        return <FileSpreadsheet className="w-8 h-8 text-slate-400" />;
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
    <Card className={`transition-all duration-200 cursor-pointer ${getStatusColor()}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          {getStatusIcon()}
        </div>
        
        <p className="text-xs text-slate-600">{description}</p>
        
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            {status.status === 'pending' ? 'Upload CSV' : 'Replace CSV'}
          </Button>
          
          {status.status === 'uploaded' && (
            <p className="text-xs text-center text-blue-600 font-medium">
              Ready for import
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}