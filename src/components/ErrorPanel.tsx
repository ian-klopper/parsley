'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, X, Trash2, Copy, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalErrorHandler } from '@/lib/error-handler';
import { cn } from '@/lib/utils';

export function ErrorPanel() {
  const [errors, setErrors] = useState<Error[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewErrors, setHasNewErrors] = useState(false);

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    // Poll for errors every 2 seconds
    const interval = setInterval(() => {
      const errorHistory = GlobalErrorHandler.getInstance().getErrorHistory();
      if (errorHistory.length > errors.length) {
        setErrors([...errorHistory]);
        setHasNewErrors(true);
        // Don't auto-open - let user click to see errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [errors.length]);

  const clearErrors = () => {
    GlobalErrorHandler.getInstance().clearErrorHistory();
    setErrors([]);
    setHasNewErrors(false);
  };

  const copyErrors = () => {
    const errorText = errors
      .map((e, i) => `Error ${i + 1}: ${e.message}\n${e.stack || ''}`)
      .join('\n\n---\n\n');
    navigator.clipboard.writeText(errorText);
  };

  // Only show in development
  if (process.env.NODE_ENV !== 'development' || errors.length === 0) return null;

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          variant="destructive"
          size="icon"
          className={cn(
            "shadow-lg",
            hasNewErrors && "animate-pulse"
          )}
        >
          <Bug className="h-4 w-4" />
          {errors.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs">
              {errors.length}
            </span>
          )}
        </Button>
      </div>

      {/* Error panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-96 max-h-[60vh] bg-background border border-destructive rounded-lg shadow-xl overflow-hidden">
          <div className="bg-destructive/10 p-3 flex items-center justify-between border-b border-destructive/20">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="font-medium text-sm">Error Log ({errors.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                onClick={copyErrors}
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Copy all errors"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                onClick={clearErrors}
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Clear all errors"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                onClick={() => {
                  setIsOpen(false);
                  setHasNewErrors(false);
                }}
                variant="ghost"
                size="icon"
                className="h-6 w-6"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[50vh] p-3 space-y-2">
            {errors.map((error, index) => (
              <div
                key={index}
                className="bg-destructive/5 border border-destructive/20 rounded p-2 text-xs"
              >
                <div className="font-mono text-destructive mb-1">
                  {error.message}
                </div>
                {error.stack && (
                  <details className="cursor-pointer">
                    <summary className="text-xs text-muted-foreground hover:text-foreground">
                      Stack trace
                    </summary>
                    <pre className="mt-1 text-xs text-muted-foreground overflow-x-auto">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}