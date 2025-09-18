import { useQuery } from '@tanstack/react-query';

export interface ExtractionProgress {
  phase: 'starting' | 'uploading' | 'processing' | 'finalizing' | 'complete' | 'idle';
  currentFile: string;
  filesProcessed: number;
  totalFiles: number;
  itemsExtracted: number;
  currentStep: string;
  progress: number; // 0-100
  startTime: number;
  estimatedTimeRemaining?: number;
}

export interface ExtractionProgressResponse {
  success: boolean;
  jobId: string;
  status: string;
  progress: ExtractionProgress;
}

export function useExtractionProgress(jobId: string, enabled: boolean = true) {
  return useQuery<ExtractionProgressResponse>({
    queryKey: ['extractionProgress', jobId],
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${jobId}/extraction-progress`);
      if (!response.ok) {
        throw new Error('Failed to fetch extraction progress');
      }
      return response.json();
    },
    enabled: enabled && !!jobId,
    refetchInterval: enabled ? 1000 : false, // Poll every second when enabled
    refetchIntervalInBackground: false,
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache for too long
  });
}