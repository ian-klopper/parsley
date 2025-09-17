'use client';

import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StorageService, JobDocument, UploadResult } from '@/lib/storage-service';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-browser';

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  uploadingFiles: number;
  completedFiles: number;
  totalFiles: number;
}

export function useFileUpload(jobId: string) {
  const { toast } = useToast();
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    uploadingFiles: 0,
    completedFiles: 0,
    totalFiles: 0
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`documents-${jobId}-realtime`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_documents',
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['job-documents', jobId] });
        }
      )
      .subscribe();

    return () => {
      if (jobId) {
        supabase.removeChannel(channel);
      }
    };
  }, [jobId, queryClient]);

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
    staleTime: 1000 * 30, // 30 seconds for faster updates
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<UploadResult> => {
      setUploadState(prev => ({
        ...prev,
        isUploading: true,
        progress: 0,
        error: null
      }));

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
          setUploadState(prev => ({
            ...prev,
            isUploading: false,
            progress: 0,
            error: result.error || 'Upload failed'
          }));
          return result;
        }

        setUploadState(prev => ({
          ...prev,
          isUploading: false,
          progress: 100,
          error: null
        }));

        return result;
      } catch (error) {
        clearInterval(progressInterval);
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        setUploadState(prev => ({
          ...prev,
          isUploading: false,
          progress: 0,
          error: errorMessage
        }));
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

  // Upload single file function
  const uploadFile = useCallback((file: File) => {
    // Validate file before upload
    const validation = StorageService.validateFile(file);
    if (!validation.valid) {
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        progress: 0,
        error: validation.error || 'Invalid file'
      }));
      toast({
        title: "Invalid file",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate(file);
  }, [uploadMutation, toast]);

  // Upload multiple files function
  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    if (fileArray.length === 0) return;

    // Validate all files first
    const invalidFiles: string[] = [];
    fileArray.forEach(file => {
      const validation = StorageService.validateFile(file);
      if (!validation.valid) {
        invalidFiles.push(`${file.name}: ${validation.error}`);
      }
    });

    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid files",
        description: `${invalidFiles.length} file(s) could not be uploaded:\n${invalidFiles.join('\n')}`,
        variant: "destructive",
      });
      return;
    }

    // Initialize upload state
    setUploadState({
      isUploading: true,
      progress: 0,
      error: null,
      uploadingFiles: fileArray.length,
      completedFiles: 0,
      totalFiles: fileArray.length
    });

    let completedCount = 0;
    const errors: string[] = [];

    // Upload files concurrently
    try {
      const uploadPromises = fileArray.map(async (file) => {
        try {
          const result = await StorageService.uploadFile(
            file,
            jobId,
            (fileProgress) => {
              // Update overall progress based on individual file progress
              setUploadState(prev => {
                const overallProgress = Math.round(
                  ((prev.completedFiles * 100) + fileProgress) / prev.totalFiles
                );
                return {
                  ...prev,
                  progress: overallProgress
                };
              });
            }
          );

          if (!result.success) {
            errors.push(`${file.name}: ${result.error}`);
          } else {
            completedCount++;
            setUploadState(prev => ({
              ...prev,
              completedFiles: prev.completedFiles + 1,
              uploadingFiles: prev.uploadingFiles - 1
            }));
          }

          return result;
        } catch (error) {
          errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Upload failed'}`);
          setUploadState(prev => ({
            ...prev,
            uploadingFiles: prev.uploadingFiles - 1
          }));
        }
      });

      await Promise.all(uploadPromises);

      // Update final state
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        progress: 100,
        error: errors.length > 0 ? `${errors.length} file(s) failed` : null
      }));

      // Show results
      if (completedCount > 0) {
        // Refresh documents list
        queryClient.invalidateQueries({ queryKey: ['job-documents', jobId] });
        queryClient.invalidateQueries({ queryKey: ['job', jobId] });

        toast({
          title: `${completedCount} file(s) uploaded successfully`,
          description: completedCount === fileArray.length
            ? "All files have been uploaded and are now available to all collaborators."
            : `${completedCount} of ${fileArray.length} files uploaded successfully.`,
        });
      }

      if (errors.length > 0) {
        toast({
          title: `${errors.length} file(s) failed to upload`,
          description: errors.join('\n'),
          variant: "destructive",
        });
      }

      // Reset progress after a short delay
      setTimeout(() => {
        setUploadState(prev => ({
          ...prev,
          progress: 0,
          completedFiles: 0,
          uploadingFiles: 0,
          totalFiles: 0
        }));
      }, 3000);

    } catch (error) {
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        progress: 0,
        error: 'Upload failed',
        completedFiles: 0,
        uploadingFiles: 0,
        totalFiles: 0
      }));

      toast({
        title: "Upload failed",
        description: "An unexpected error occurred during upload",
        variant: "destructive",
      });
    }
  }, [jobId, queryClient, toast]);

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
    uploadFiles,
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