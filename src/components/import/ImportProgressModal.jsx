import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ImportProgressModal({ progress, onClose }) {
  const {
    isImporting,
    currentEntity,
    currentIndex,
    totalItems,
    entityProgress,
    errors,
    summary
  } = progress;

  // Calculate overall progress
  const overallProgress = totalItems > 0 ? (currentIndex / totalItems) * 100 : 0;

  // Get entity display name
  const getEntityDisplayName = (entity) => {
    return entity.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <Dialog open={isImporting || summary !== null} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {summary ? 'Import Summary' : 'Import Progress'}
          </DialogTitle>
        </DialogHeader>

        {!summary ? (
          // Progress View
          <div className="space-y-4">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span>{currentIndex} of {totalItems} items</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
              {currentEntity && (
                <p className="text-sm text-muted-foreground">
                  Currently processing: {getEntityDisplayName(currentEntity)}
                </p>
              )}
            </div>

            {/* Entity Progress */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Progress by Entity</h3>
              {Object.entries(entityProgress).map(([entity, progress]) => (
                <div key={entity} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(progress.status)}
                      <span>{getEntityDisplayName(entity)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">{progress.success || 0} ✓</span>
                      {progress.failed > 0 && (
                        <span className="text-red-600">{progress.failed} ✗</span>
                      )}
                      <span className="text-muted-foreground">
                        / {progress.total}
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={(progress.processed / progress.total) * 100} 
                    className="h-1"
                  />
                </div>
              ))}
            </div>

            {/* Recent Errors */}
            {errors.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  Recent Errors ({errors.length})
                </h3>
                <ScrollArea className="h-32 w-full border rounded-md p-2">
                  <div className="space-y-1">
                    {errors.slice(-10).map((error, idx) => (
                      <div key={idx} className="text-xs text-red-600">
                        <span className="font-medium">{error.entity} {error.id}:</span> {error.message}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        ) : (
          // Summary View
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{summary.successful}</p>
                <p className="text-sm text-green-600">Successful</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-700">{summary.failed}</p>
                <p className="text-sm text-red-600">Failed</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">{summary.total}</p>
                <p className="text-sm text-blue-600">Total</p>
              </div>
            </div>

            {/* Entity Summary */}
            <div className="space-y-2">
              <h3 className="font-medium">Results by Entity</h3>
              {Object.entries(summary.byEntity || {}).map(([entity, stats]) => (
                <div key={entity} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{getEntityDisplayName(entity)}</span>
                  <div className="flex items-center gap-4">
                    <Badge variant="success" className="bg-green-100">
                      {stats.success} succeeded
                    </Badge>
                    {stats.failed > 0 && (
                      <Badge variant="destructive" className="bg-red-100">
                        {stats.failed} failed
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Error Details */}
            {errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Error Details</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadErrorReport(errors)}
                  >
                    Download Error Report
                  </Button>
                </div>
                <ScrollArea className="h-48 w-full border rounded-md p-3">
                  <div className="space-y-2">
                    {errors.map((error, idx) => (
                      <div key={idx} className="p-2 bg-red-50 rounded text-sm">
                        <div className="font-medium text-red-800">
                          {error.entity} - {error.id}
                        </div>
                        <div className="text-red-600">{error.message}</div>
                        {error.data && (
                          <details className="mt-1">
                            <summary className="text-xs cursor-pointer">View data</summary>
                            <pre className="text-xs mt-1 p-1 bg-white rounded overflow-x-auto">
                              {JSON.stringify(error.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              {errors.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => downloadErrorReport(errors)}
                >
                  Download Error Report
                </Button>
              )}
              <Button onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Helper function to download error report
function downloadErrorReport(errors) {
  const csv = [
    ['Entity', 'ID', 'Error Message', 'Data'].join(','),
    ...errors.map(err => [
      err.entity,
      err.id,
      `"${err.message.replace(/"/g, '""')}"`,
      err.data ? `"${JSON.stringify(err.data).replace(/"/g, '""')}"` : ''
    ].join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `import_errors_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}