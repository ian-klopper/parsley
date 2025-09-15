'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { JobService, Job, CreateJobRequest, UpdateJobRequest } from '@/lib/job-service';
import { useToast } from '@/hooks/use-toast';

const JOBS_QUERY_KEY = 'jobs';

// Get all jobs with caching
export function useJobs() {
  return useQuery({
    queryKey: [JOBS_QUERY_KEY],
    queryFn: async () => {
      const result = await JobService.getJobs();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data || [];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Get single job with caching
export function useJob(id: string) {
  return useQuery({
    queryKey: [JOBS_QUERY_KEY, id],
    queryFn: async () => {
      const result = await JobService.getJob(id);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Create job with optimistic updates
export function useCreateJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (jobData: CreateJobRequest) => {
      const result = await JobService.createJob(jobData);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data!;
    },
    onMutate: async (newJobData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: [JOBS_QUERY_KEY] });

      // Snapshot previous value
      const previousJobs = queryClient.getQueryData<Job[]>([JOBS_QUERY_KEY]);

      // Optimistically update to the new value
      if (previousJobs) {
        const optimisticJob: Job = {
          id: 'temp-' + Date.now(),
          venue: newJobData.venue,
          job_id: newJobData.job_id,
          status: newJobData.status || 'draft',
          created_by: 'temp-user',
          owner_id: 'temp-user',
          collaborators: newJobData.collaborators || [],
          last_activity: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<Job[]>([JOBS_QUERY_KEY], [optimisticJob, ...previousJobs]);
      }

      // Return context object with snapshot value
      return { previousJobs };
    },
    onError: (err, newJobData, context) => {
      // Rollback optimistic update on error
      if (context?.previousJobs) {
        queryClient.setQueryData([JOBS_QUERY_KEY], context.previousJobs);
      }
      toast({
        title: "Error creating job",
        description: err.message,
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Job created successfully",
        description: `Job "${data.job_id}" has been created.`,
      });

      // Refetch to get the real data from server
      queryClient.invalidateQueries({ queryKey: [JOBS_QUERY_KEY] });
    },
  });
}

// Update job with optimistic updates
export function useUpdateJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateJobRequest }) => {
      const result = await JobService.updateJob(id, data);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data!;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: [JOBS_QUERY_KEY, id] });
      await queryClient.cancelQueries({ queryKey: [JOBS_QUERY_KEY] });

      const previousJob = queryClient.getQueryData<Job>([JOBS_QUERY_KEY, id]);
      const previousJobs = queryClient.getQueryData<Job[]>([JOBS_QUERY_KEY]);

      // Optimistically update single job
      if (previousJob) {
        const updatedJob = { ...previousJob, ...data, updated_at: new Date().toISOString() };
        queryClient.setQueryData([JOBS_QUERY_KEY, id], updatedJob);

        // Update in jobs list too
        if (previousJobs) {
          const updatedJobs = previousJobs.map(job =>
            job.id === id ? updatedJob : job
          );
          queryClient.setQueryData([JOBS_QUERY_KEY], updatedJobs);
        }
      }

      return { previousJob, previousJobs };
    },
    onError: (err, { id }, context) => {
      // Rollback optimistic updates
      if (context?.previousJob) {
        queryClient.setQueryData([JOBS_QUERY_KEY, id], context.previousJob);
      }
      if (context?.previousJobs) {
        queryClient.setQueryData([JOBS_QUERY_KEY], context.previousJobs);
      }
      toast({
        title: "Error updating job",
        description: err.message,
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Job updated successfully",
        description: `Job "${data.job_id}" has been updated.`,
      });

      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: [JOBS_QUERY_KEY] });
    },
  });
}

// Delete job with optimistic updates
export function useDeleteJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const result = await JobService.deleteJob(jobId);
      if (result.error) {
        throw new Error(result.error);
      }
      return jobId;
    },
    onMutate: async (jobId) => {
      await queryClient.cancelQueries({ queryKey: [JOBS_QUERY_KEY] });

      const previousJobs = queryClient.getQueryData<Job[]>([JOBS_QUERY_KEY]);

      // Optimistically remove from list
      if (previousJobs) {
        const filteredJobs = previousJobs.filter(job => job.id !== jobId);
        queryClient.setQueryData([JOBS_QUERY_KEY], filteredJobs);
      }

      return { previousJobs };
    },
    onError: (err, jobId, context) => {
      // Rollback optimistic update
      if (context?.previousJobs) {
        queryClient.setQueryData([JOBS_QUERY_KEY], context.previousJobs);
      }
      toast({
        title: "Error deleting job",
        description: err.message,
        variant: "destructive",
      });
    },
    onSuccess: (jobId) => {
      // Remove from individual job cache too
      queryClient.removeQueries({ queryKey: [JOBS_QUERY_KEY, jobId] });

      toast({
        title: "Job deleted successfully",
        description: "The job has been permanently deleted.",
      });
    },
  });
}

// Transfer ownership with optimistic updates
export function useTransferOwnership() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ jobId, newOwnerEmail }: { jobId: string; newOwnerEmail: string }) => {
      const result = await JobService.transferOwnership(jobId, newOwnerEmail);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data!;
    },
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: [JOBS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [JOBS_QUERY_KEY, data.id] });

      toast({
        title: "Ownership transferred successfully",
        description: `Job "${data.job_id}" ownership has been transferred.`,
      });
    },
    onError: (err) => {
      toast({
        title: "Error transferring ownership",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}