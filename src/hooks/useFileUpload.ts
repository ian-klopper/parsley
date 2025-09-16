'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StorageService, JobDocument, UploadResult } from '@/lib/storage-service';
import { useToast } from '@/hooks/use-toast';

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
}

export function useFileUpload(jobId: string) {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query to get job documents
  const {
    data: documents = [],
    isLoading: isLoadingDocuments,
    error: documentsError
  } = useQuery({
    queryKey: ['job-documents', jobId],
    queryFn: async () => {
      const result = await StorageService.getJobDocuments(jobId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.documents || [];
    },
    enabled: !!jobId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<UploadResult> => {
      setUploadState({
        isUploading: true,
        progress: 0,
        error: null
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90)
        }));
      }, 200);

      try {
        const result = await StorageService.uploadFile(
          file,
          jobId,
          (progress) => {
            setUploadState(prev => ({
              ...prev,
              progress
            }));
          }
        );

        clearInterval(progressInterval);

        if (!result.success) {
          setUploadState({
            isUploading: false,
            progress: 0,
            error: result.error || 'Upload failed'
          });
          return result;
        }

        setUploadState({
          isUploading: false,
          progress: 100,
          error: null
        });

        return result;
      } catch (error) {
        clearInterval(progressInterval);
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        setUploadState({
          isUploading: false,
          progress: 0,
          error: errorMessage
        });
        throw error;
      }
    },
    onSuccess: () => {
      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ['job-documents', jobId] });

      // Update job's last activity
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });

      toast({
        title: "File uploaded successfully",
        description: "The file has been uploaded and is now available to all collaborators.",
      });

      // Reset progress after a short delay
      setTimeout(() => {
        setUploadState(prev => ({ ...prev, progress: 0 }));
      }, 2000);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const result = await StorageService.deleteDocument(documentId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ['job-documents', jobId] });

      toast({
        title: "File deleted",
        description: "The file has been removed successfully.",
      });
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete file",
        variant: "destructive",
      });
    },
  });

  // Upload function
  const uploadFile = useCallback((file: File) => {
    // Validate file before upload
    const validation = StorageService.validateFile(file);
    if (!validation.valid) {
      setUploadState({
        isUploading: false,
        progress: 0,
        error: validation.error || 'Invalid file'
      });
      toast({
        title: "Invalid file",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate(file);
  }, [uploadMutation, toast]);

  // Delete function
  const deleteDocument = useCallback((documentId: string) => {
    deleteMutation.mutate(documentId);
  }, [deleteMutation]);

  // Get download URL function
  const getDownloadUrl = useCallback(async (document: JobDocument) => {
    try {
      const result = await StorageService.getDownloadUrl(document.storage_path);
      if (result.success && result.url) {
        // Open in new tab
        window.open(result.url, '_blank');
      } else {
        toast({
          title: "Download failed",
          description: result.error || "Failed to get download URL",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  }, [toast]);

  return {
    // Documents
    documents,
    isLoadingDocuments,
    documentsError,

    // Upload state
    uploadState,
    isUploading: uploadState.isUploading,
    uploadProgress: uploadState.progress,
    uploadError: uploadState.error,

    // Actions
    uploadFile,
    deleteDocument,
    getDownloadUrl,

    // Mutation states
    isDeleting: deleteMutation.isPending,

    // Utilities
    validateFile: StorageService.validateFile,
    formatFileSize: StorageService.formatFileSize,
    getFileIcon: StorageService.getFileIcon,
  };
}