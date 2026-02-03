/**
 * Log Download Button Component
 * 
 * Provides a button to download or copy console logs for debugging
 */

'use client';

import { Button } from '@/components/ui/button';
import { Download, Copy, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function LogDownloadButton() {
  const [logCount, setLogCount] = useState(0);

  useEffect(() => {
    // Update log count periodically
    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && (window as any).weleapLogger) {
        const logs = (window as any).weleapLogger.getLogs();
        setLogCount(logs.length);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleDownload = () => {
    if (typeof window !== 'undefined' && (window as any).weleapLogger) {
      console.log('Downloading logs...', {
        logCount: (window as any).weleapLogger.getLogs().length,
      });
      (window as any).weleapLogger.download();
    } else {
      console.error('Logger not initialized. window.weleapLogger:', (window as any).weleapLogger);
      alert('Logger not initialized. Please refresh the page.');
    }
  };

  const handleDownloadJSON = () => {
    if (typeof window !== 'undefined' && (window as any).weleapLogger) {
      (window as any).weleapLogger.downloadJSON();
    }
  };

  const handleCopy = () => {
    if (typeof window !== 'undefined' && (window as any).weleapLogger) {
      (window as any).weleapLogger.copy();
    }
  };

  const handleClear = () => {
    if (typeof window !== 'undefined' && (window as any).weleapLogger) {
      if (confirm('Clear all logs? This cannot be undone.')) {
        (window as any).weleapLogger.clear();
        setLogCount(0);
      }
    }
  };

  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 rounded-lg border bg-background p-2 shadow-lg">
      <div className="text-xs text-slate-600 dark:text-slate-400">
        Logs: {logCount}
      </div>
      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownload}
          className="h-8 text-xs"
        >
          <Download className="mr-1 h-3 w-3" />
          Download TXT
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownloadJSON}
          className="h-8 text-xs"
        >
          <Download className="mr-1 h-3 w-3" />
          Download JSON
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="h-8 text-xs"
        >
          <Copy className="mr-1 h-3 w-3" />
          Copy
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleClear}
          className="h-8 text-xs text-red-600 hover:text-red-700"
        >
          <Trash2 className="mr-1 h-3 w-3" />
          Clear
        </Button>
      </div>
    </div>
  );
}

