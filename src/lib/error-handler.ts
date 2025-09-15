import { toast } from '@/hooks/use-toast';

export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private errorQueue: Error[] = [];

  private constructor() {
    this.setupGlobalHandlers();
  }

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  private setupGlobalHandlers() {
    if (typeof window === 'undefined') return;

    // Handle unhandled promise rejections (only log critical ones)
    window.addEventListener('unhandledrejection', (event) => {
      // Filter out non-critical rejections
      const message = event.reason?.message || event.reason || '';

      // Ignore certain common non-critical errors
      if (typeof message === 'string' && (
        message.includes('ResizeObserver') ||
        message.includes('Non-Error promise rejection') ||
        message.includes('Network request failed') ||
        message.includes('Load failed')
      )) {
        return;
      }

      console.error('Unhandled promise rejection:', event.reason);
      // Only show in development
      if (process.env.NODE_ENV === 'development') {
        this.handleError(
          new Error(`Unhandled Promise: ${message}`),
          'Promise Rejection'
        );
      }
      event.preventDefault();
    });

    // Handle uncaught errors (only critical ones)
    window.addEventListener('error', (event) => {
      // Ignore certain errors
      if (event.message?.includes('ResizeObserver')) {
        return;
      }

      console.error('Uncaught error:', event.error);

      // Only show truly critical errors
      if (event.error && process.env.NODE_ENV === 'development') {
        this.handleError(
          event.error || new Error(event.message || 'Unknown error'),
          'Runtime Error'
        );
      }
      event.preventDefault();
    });
  }

  public handleError(error: Error, context?: string) {
    // Add to error queue
    this.errorQueue.push(error);

    // Keep only last 20 errors
    if (this.errorQueue.length > 20) {
      this.errorQueue.shift();
    }

    // Show toast notification
    const title = context || 'Error';
    const description = error.message || 'An unexpected error occurred';

    // Only show toast for important errors (not console errors)
    if (context !== 'Console Error') {
      toast({
        title,
        description: description.length > 100 ? description.substring(0, 100) + '...' : description,
        variant: 'destructive',
        duration: 5000, // Show for 5 seconds
      });
    }

    // Log to console in development only
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 ${title}`);
      console.error('Error details:', error);
      console.error('Stack trace:', error.stack);
      console.error('Context:', context);
      console.groupEnd();
    }
  }

  public getErrorHistory(): Error[] {
    return [...this.errorQueue];
  }

  public clearErrorHistory(): void {
    this.errorQueue = [];
  }
}

// Initialize on import
if (typeof window !== 'undefined') {
  GlobalErrorHandler.getInstance();
}

// Export convenience function
export function reportError(error: Error | string, context?: string) {
  const errorObj = typeof error === 'string' ? new Error(error) : error;
  GlobalErrorHandler.getInstance().handleError(errorObj, context);
}