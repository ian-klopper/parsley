import { apiClient } from './services/api-client';

export interface Job {
  id: string
  venue: string
  job_id: string
  status: 'draft' | 'live' | 'processing' | 'complete' | 'error'
  created_by: string
  owner_id: string  // Added for ownership transfer
  collaborators: string[]  // Array of user IDs
  last_activity: string
  created_at: string
  updated_at: string
  // Related data from joins
  creator?: {
    id: string
    email: string
    full_name: string
    initials: string
    color_index: number
  }
  owner?: {
    id: string
    email: string
    full_name: string
    initials: string
    color_index: number
  }
  collaborator_users?: Array<{
    id: string
    email: string
    full_name: string
    initials: string
    color_index: number
  }>
}

export interface CreateJobRequest {
  venue: string
  job_id: string
  collaborators: string[]  // Array of user IDs
  status?: 'draft' | 'live'
}

export interface UpdateJobRequest {
  venue?: string
  status?: 'draft' | 'live' | 'processing' | 'complete' | 'error'
  collaborators?: string[]
}

export class JobService {
  /**
   * Get all jobs with creator and collaborator information
   */
  static async getJobs(): Promise<{ data: Job[] | null; error: string | null }> {
    try {
      const result = await apiClient.getJobs();
      return { data: result.data, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch jobs';

      // If user profile not found or insufficient permissions, return empty array
      if (errorMessage.includes('User profile not found') || errorMessage.includes('Insufficient permissions')) {
        return { data: [], error: null };
      }

      console.error('Error fetching jobs:', error);
      return { data: null, error: errorMessage };
    }
  }

  /**
   * Get a single job by ID
   */
  static async getJob(id: string): Promise<{ data: Job | null; error: string | null }> {
    try {
      const result = await apiClient.getJob(id);
      return { data: result.data, error: null };
    } catch (error) {
      console.error('Error fetching job:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Failed to fetch job' };
    }
  }

  /**
   * Create a new job
   */
  static async createJob(jobData: CreateJobRequest): Promise<{ data: Job | null; error: string | null }> {
    try {
      const result = await apiClient.createJob(jobData);
      return { data: result.data, error: null };
    } catch (error) {
      console.error('Error creating job:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Failed to create job' };
    }
  }

  /**
   * Update an existing job
   */
  static async updateJob(id: string, jobData: UpdateJobRequest): Promise<{ data: Job | null; error: string | null }> {
    try {
      const result = await apiClient.updateJob(id, jobData);
      return { data: result.data, error: null };
    } catch (error) {
      console.error('Error updating job:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Failed to update job' };
    }
  }

  /**
   * Delete a job
   */
  static async deleteJob(jobId: string): Promise<{ error: string | null }> {
    try {
      const result = await apiClient.deleteJob(jobId);
      return { error: null };
    } catch (error) {
      console.error('Error deleting job:', error);
      return { error: error instanceof Error ? error.message : 'Failed to delete job' };
    }
  }

  /**
   * Transfer job ownership
   */
  static async transferOwnership(jobId: string, newOwnerEmail: string): Promise<{ data: Job | null; error: string | null }> {
    try {
      const result = await apiClient.transferJobOwnership(jobId, newOwnerEmail);
      return { data: result.data, error: null };
    } catch (error) {
      console.error('Error transferring ownership:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Failed to transfer ownership' };
    }
  }

  // Get a single job by ID
  static async getJobById(jobId: string): Promise<{ job: Job | null; error: string | null }> {
    try {
      const result = await apiClient.getJob(jobId);
      return { job: result.data, error: null };
    } catch (error) {
      console.error('Error fetching job:', error);
      return { job: null, error: error instanceof Error ? error.message : 'Failed to fetch job' };
    }
  }

  // Legacy method for backward compatibility
  static async getAllJobs(): Promise<{ jobs: Job[] | null; error: string | null }> {
    const result = await this.getJobs();
    return { jobs: result.data, error: result.error };
  }
}