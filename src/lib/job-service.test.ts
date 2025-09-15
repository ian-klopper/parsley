import { JobService, CreateJobRequest, UpdateJobRequest } from './job-service'
import { apiClient } from './services/api-client'
import { createMockJob, testJobs, testUsers } from './test-utils'

// Mock the API client
jest.mock('./services/api-client')
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>

describe('JobService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getJobs', () => {
    it('should successfully fetch all jobs', async () => {
      mockApiClient.getJobs.mockResolvedValue({ data: testJobs })

      const result = await JobService.getJobs()

      expect(mockApiClient.getJobs).toHaveBeenCalledTimes(1)
      expect(result.data).toEqual(testJobs)
      expect(result.error).toBeNull()
    })

    it('should handle empty job list', async () => {
      mockApiClient.getJobs.mockResolvedValue({ data: [] })

      const result = await JobService.getJobs()

      expect(result.data).toEqual([])
      expect(result.error).toBeNull()
    })

    it('should handle API errors', async () => {
      mockApiClient.getJobs.mockRejectedValue(new Error('Database connection failed'))

      const result = await JobService.getJobs()

      expect(result.data).toBeNull()
      expect(result.error).toBe('Database connection failed')
    })

    it('should handle network errors', async () => {
      mockApiClient.getJobs.mockRejectedValue(new Error('Network error'))

      const result = await JobService.getJobs()

      expect(result.data).toBeNull()
      expect(result.error).toBe('Network error')
    })
  })

  describe('getJob', () => {
    it('should successfully fetch a single job', async () => {
      const jobId = 'job-123'
      const mockJob = createMockJob({ id: jobId })
      mockApiClient.getJob.mockResolvedValue({ data: mockJob })

      const result = await JobService.getJob(jobId)

      expect(mockApiClient.getJob).toHaveBeenCalledWith(jobId)
      expect(result.data).toEqual(mockJob)
      expect(result.error).toBeNull()
    })

    it('should handle job not found', async () => {
      const jobId = 'nonexistent-job'
      mockApiClient.getJob.mockRejectedValue(new Error('Job not found'))

      const result = await JobService.getJob(jobId)

      expect(result.data).toBeNull()
      expect(result.error).toBe('Job not found')
    })

    it('should handle permission denied errors', async () => {
      const jobId = 'restricted-job'
      mockApiClient.getJob.mockRejectedValue(new Error('Insufficient permissions'))

      const result = await JobService.getJob(jobId)

      expect(result.data).toBeNull()
      expect(result.error).toBe('Insufficient permissions')
    })
  })

  describe('createJob', () => {
    it('should successfully create a job', async () => {
      const jobData: CreateJobRequest = {
        venue: 'Test Restaurant',
        job_id: 'TEST-001',
        collaborators: ['user-1', 'user-2']
      }
      const createdJob = createMockJob(jobData)
      mockApiClient.createJob.mockResolvedValue({ data: createdJob })

      const result = await JobService.createJob(jobData)

      expect(mockApiClient.createJob).toHaveBeenCalledWith(jobData)
      expect(result.data).toEqual(createdJob)
      expect(result.error).toBeNull()
    })

    it('should create job with default status', async () => {
      const jobData: CreateJobRequest = {
        venue: 'Test Restaurant',
        job_id: 'TEST-002',
        collaborators: []
      }
      const createdJob = createMockJob({ ...jobData, status: 'draft' })
      mockApiClient.createJob.mockResolvedValue({ data: createdJob })

      const result = await JobService.createJob(jobData)

      expect(result.data?.status).toBe('draft')
    })

    it('should create job with specified status', async () => {
      const jobData: CreateJobRequest = {
        venue: 'Live Restaurant',
        job_id: 'LIVE-001',
        collaborators: [],
        status: 'live'
      }
      const createdJob = createMockJob({ ...jobData, status: 'live' })
      mockApiClient.createJob.mockResolvedValue({ data: createdJob })

      const result = await JobService.createJob(jobData)

      expect(result.data?.status).toBe('live')
    })

    it('should handle validation errors', async () => {
      const invalidJobData = {
        venue: '', // Empty venue
        job_id: 'TEST-001',
        collaborators: []
      } as CreateJobRequest

      mockApiClient.createJob.mockRejectedValue(new Error('Venue name is required'))

      const result = await JobService.createJob(invalidJobData)

      expect(result.data).toBeNull()
      expect(result.error).toBe('Venue name is required')
    })

    it('should handle duplicate job ID errors', async () => {
      const jobData: CreateJobRequest = {
        venue: 'Test Restaurant',
        job_id: 'DUPLICATE-001',
        collaborators: []
      }

      mockApiClient.createJob.mockRejectedValue(new Error('Job ID already exists'))

      const result = await JobService.createJob(jobData)

      expect(result.data).toBeNull()
      expect(result.error).toBe('Job ID already exists')
    })
  })

  describe('updateJob', () => {
    it('should successfully update a job', async () => {
      const jobId = 'job-123'
      const updateData: UpdateJobRequest = {
        venue: 'Updated Restaurant Name',
        status: 'live'
      }
      const updatedJob = createMockJob({ id: jobId, ...updateData })
      mockApiClient.updateJob.mockResolvedValue({ data: updatedJob })

      const result = await JobService.updateJob(jobId, updateData)

      expect(mockApiClient.updateJob).toHaveBeenCalledWith(jobId, updateData)
      expect(result.data).toEqual(updatedJob)
      expect(result.error).toBeNull()
    })

    it('should update job collaborators', async () => {
      const jobId = 'job-123'
      const updateData: UpdateJobRequest = {
        collaborators: ['user-1', 'user-2', 'user-3']
      }
      const updatedJob = createMockJob({
        id: jobId,
        collaborators: updateData.collaborators,
        collaborator_users: [testUsers[1], testUsers[2], testUsers[3]]
      })
      mockApiClient.updateJob.mockResolvedValue({ data: updatedJob })

      const result = await JobService.updateJob(jobId, updateData)

      expect(result.data?.collaborators).toEqual(['user-1', 'user-2', 'user-3'])
      expect(result.data?.collaborator_users).toHaveLength(3)
    })

    it('should update job status', async () => {
      const jobId = 'job-123'
      const updateData: UpdateJobRequest = {
        status: 'complete'
      }
      const updatedJob = createMockJob({ id: jobId, status: 'complete' })
      mockApiClient.updateJob.mockResolvedValue({ data: updatedJob })

      const result = await JobService.updateJob(jobId, updateData)

      expect(result.data?.status).toBe('complete')
    })

    it('should handle permission denied errors', async () => {
      const jobId = 'restricted-job'
      const updateData: UpdateJobRequest = { venue: 'New Name' }

      mockApiClient.updateJob.mockRejectedValue(new Error('Only job creator can update'))

      const result = await JobService.updateJob(jobId, updateData)

      expect(result.data).toBeNull()
      expect(result.error).toBe('Only job creator can update')
    })

    it('should handle invalid status transitions', async () => {
      const jobId = 'job-123'
      const updateData: UpdateJobRequest = {
        status: 'draft' // Invalid transition from complete to draft
      }

      mockApiClient.updateJob.mockRejectedValue(new Error('Invalid status transition'))

      const result = await JobService.updateJob(jobId, updateData)

      expect(result.data).toBeNull()
      expect(result.error).toBe('Invalid status transition')
    })
  })

  describe('deleteJob', () => {
    it('should successfully delete a job', async () => {
      const jobId = 'job-to-delete'
      mockApiClient.deleteJob.mockResolvedValue(undefined)

      const result = await JobService.deleteJob(jobId)

      expect(mockApiClient.deleteJob).toHaveBeenCalledWith(jobId)
      expect(result.error).toBeNull()
    })

    it('should handle job not found errors', async () => {
      const jobId = 'nonexistent-job'
      mockApiClient.deleteJob.mockRejectedValue(new Error('Job not found'))

      const result = await JobService.deleteJob(jobId)

      expect(result.error).toBe('Job not found')
    })

    it('should handle permission denied errors', async () => {
      const jobId = 'restricted-job'
      mockApiClient.deleteJob.mockRejectedValue(new Error('Only job creator can delete'))

      const result = await JobService.deleteJob(jobId)

      expect(result.error).toBe('Only job creator can delete')
    })

    it('should handle deletion of jobs with active collaborators', async () => {
      const jobId = 'job-with-collaborators'
      mockApiClient.deleteJob.mockRejectedValue(new Error('Cannot delete job with active collaborators'))

      const result = await JobService.deleteJob(jobId)

      expect(result.error).toBe('Cannot delete job with active collaborators')
    })
  })

  describe('transferOwnership', () => {
    it('should successfully transfer job ownership', async () => {
      const jobId = 'job-123'
      const newOwnerId = 'new-owner-456'
      const transferredJob = createMockJob({
        id: jobId,
        owner_id: newOwnerId,
        owner: {
          id: newOwnerId,
          email: 'newowner@test.com',
          full_name: 'New Owner',
          initials: 'NO',
          color_index: 3
        }
      })
      mockApiClient.transferJobOwnership.mockResolvedValue({ data: transferredJob })

      const result = await JobService.transferOwnership(jobId, newOwnerId)

      expect(mockApiClient.transferJobOwnership).toHaveBeenCalledWith(jobId, newOwnerId)
      expect(result.data?.owner_id).toBe(newOwnerId)
      expect(result.error).toBeNull()
    })

    it('should handle invalid ownership transfer', async () => {
      const jobId = 'job-123'
      const newOwnerId = 'invalid-user'
      mockApiClient.transferJobOwnership.mockRejectedValue(new Error('New owner must be a valid user'))

      const result = await JobService.transferOwnership(jobId, newOwnerId)

      expect(result.data).toBeNull()
      expect(result.error).toBe('New owner must be a valid user')
    })

    it('should handle permission denied for ownership transfer', async () => {
      const jobId = 'job-123'
      const newOwnerId = 'user-456'
      mockApiClient.transferJobOwnership.mockRejectedValue(new Error('Only current owner can transfer'))

      const result = await JobService.transferOwnership(jobId, newOwnerId)

      expect(result.data).toBeNull()
      expect(result.error).toBe('Only current owner can transfer')
    })
  })

  describe('getAllJobs (legacy method)', () => {
    it('should return jobs in legacy format', async () => {
      mockApiClient.getJobs.mockResolvedValue({ data: testJobs })

      const result = await JobService.getAllJobs()

      expect(result.jobs).toEqual(testJobs)
      expect(result.error).toBeNull()
    })

    it('should handle errors in legacy format', async () => {
      mockApiClient.getJobs.mockRejectedValue(new Error('Network error'))

      const result = await JobService.getAllJobs()

      expect(result.jobs).toBeNull()
      expect(result.error).toBe('Network error')
    })
  })

  describe('Error handling', () => {
    it('should handle non-Error exceptions', async () => {
      mockApiClient.getJobs.mockRejectedValue('String error')

      const result = await JobService.getJobs()

      expect(result.data).toBeNull()
      expect(result.error).toBe('Failed to fetch jobs')
    })

    it('should handle undefined errors', async () => {
      mockApiClient.createJob.mockRejectedValue(undefined)

      const result = await JobService.createJob({
        venue: 'Test',
        job_id: 'TEST-001',
        collaborators: []
      })

      expect(result.data).toBeNull()
      expect(result.error).toBe('Failed to create job')
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete job lifecycle', async () => {
      // Create job
      const jobData: CreateJobRequest = {
        venue: 'Lifecycle Restaurant',
        job_id: 'LIFE-001',
        collaborators: ['user-1']
      }
      const createdJob = createMockJob({ ...jobData, status: 'draft' })
      mockApiClient.createJob.mockResolvedValue({ data: createdJob })

      const createResult = await JobService.createJob(jobData)
      expect(createResult.data?.status).toBe('draft')

      // Update to live
      const liveJob = createMockJob({ ...createdJob, status: 'live' })
      mockApiClient.updateJob.mockResolvedValue({ data: liveJob })

      const updateResult = await JobService.updateJob(createdJob.id, { status: 'live' })
      expect(updateResult.data?.status).toBe('live')

      // Complete the job
      const completeJob = createMockJob({ ...liveJob, status: 'complete' })
      mockApiClient.updateJob.mockResolvedValue({ data: completeJob })

      const completeResult = await JobService.updateJob(createdJob.id, { status: 'complete' })
      expect(completeResult.data?.status).toBe('complete')
    })

    it('should handle collaborator management workflow', async () => {
      const jobId = 'job-123'
      const initialJob = createMockJob({ id: jobId, collaborators: [] })

      // Add first collaborator
      const withCollaborator1 = createMockJob({
        id: jobId,
        collaborators: ['user-1'],
        collaborator_users: [testUsers[1]]
      })
      mockApiClient.updateJob.mockResolvedValueOnce({ data: withCollaborator1 })

      const result1 = await JobService.updateJob(jobId, { collaborators: ['user-1'] })
      expect(result1.data?.collaborators).toEqual(['user-1'])

      // Add second collaborator
      const withCollaborator2 = createMockJob({
        id: jobId,
        collaborators: ['user-1', 'user-2'],
        collaborator_users: [testUsers[1], testUsers[2]]
      })
      mockApiClient.updateJob.mockResolvedValueOnce({ data: withCollaborator2 })

      const result2 = await JobService.updateJob(jobId, { collaborators: ['user-1', 'user-2'] })
      expect(result2.data?.collaborators).toEqual(['user-1', 'user-2'])

      // Remove first collaborator
      const withOneCollaborator = createMockJob({
        id: jobId,
        collaborators: ['user-2'],
        collaborator_users: [testUsers[2]]
      })
      mockApiClient.updateJob.mockResolvedValueOnce({ data: withOneCollaborator })

      const result3 = await JobService.updateJob(jobId, { collaborators: ['user-2'] })
      expect(result3.data?.collaborators).toEqual(['user-2'])
    })

    it('should handle concurrent job operations', async () => {
      const jobId = 'concurrent-job'
      const update1 = { venue: 'Updated Name 1' }
      const update2 = { status: 'live' as const }

      const job1 = createMockJob({ id: jobId, ...update1 })
      const job2 = createMockJob({ id: jobId, ...update2 })

      mockApiClient.updateJob
        .mockResolvedValueOnce({ data: job1 })
        .mockResolvedValueOnce({ data: job2 })

      const [result1, result2] = await Promise.all([
        JobService.updateJob(jobId, update1),
        JobService.updateJob(jobId, update2)
      ])

      expect(result1.data?.venue).toBe('Updated Name 1')
      expect(result2.data?.status).toBe('live')
      expect(result1.error).toBeNull()
      expect(result2.error).toBeNull()
    })
  })
})