'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 30, // 30 minutes (renamed from cacheTime)
            refetchOnWindowFocus: false,
            retry: (failureCount, error: any) => {
              // Don't retry on authentication errors
              if (error?.message?.includes('authentication') ||
                  error?.message?.includes('unauthorized') ||
                  error?.status === 401) {
                return false;
              }
              return failureCount < 3;
            },
          },
          mutations: {
            retry: (failureCount, error: any) => {
              // Don't retry auth errors
              if (error?.message?.includes('authentication') ||
                  error?.status === 401) {
                return false;
              }
              return false;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}