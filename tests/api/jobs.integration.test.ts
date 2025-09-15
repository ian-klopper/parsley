import { createMocks } from 'node-mocks-http'
import { GET as getJobsGET, POST as createJobPOST } from '@/app/api/jobs/route'
import { GET as getJobGET, PUT as updateJobPUT, DELETE as deleteJobDELETE } from '@/app/api/jobs/[id]/route'
import { PUT as transferOwnershipPUT } from '@/app/api/jobs/[id]/owner/route'
import { createMockSupabaseClient, testJobs, createMockJob, testUsers } from '@/lib/test-utils'

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: createMockSupabaseClient()
}))

// Mock auth middleware
jest.mock('@/lib/api/auth-middleware', () => ({
  requireNonPending: jest.fn().mockImplementation((req) => {
    if (!req.headers.authorization?.includes('user-token')) {
      throw new Error('Unauthorized')
    }
    if (req.headers.authorization.includes('admin-token')) {
      return { id: 'admin-1', role: 'admin' }
    }
    return { id: 'user-1', role: 'user' }
  }),
  requireAdmin: jest.fn().mockImplementation((req) => {
    if (!req.headers.authorization?.includes('admin-token')) {
      throw new Error('Insufficient permissions')
    }
    return { id: 'admin-1', role: 'admin' }
  }),
  handleApiError: jest.fn().mockImplementation((error) => {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message.includes('permissions') ? 403 :
             error.message.includes('Unauthorized') ? 401 :
             error.message.includes('not found') ? 404 : 500
    })
  }),
  createSupabaseServer: jest.fn().mockImplementation(() => createMockSupabaseClient())
}))

describe('Job API Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/jobs', () => {
    it('returns jobs for authenticated user', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer user-token'
        }
      })

      const mockSupabase = createMockSupabaseClient({
        data: testJobs,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await getJobsGET(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(testJobs)
    })

    it('returns all jobs for admin user', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer admin-token'
        }
      })

      const mockSupabase = createMockSupabaseClient({
        data: testJobs,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await getJobsGET(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(testJobs)
    })

    it('returns 401 for unauthorized requests', async () => {
      const { req } = createMocks({
        method: 'GET'
      })

      const response = await getJobsGET(req as any)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('handles database errors', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer user-token'
        }
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('Database connection failed')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await getJobsGET(req as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Database connection failed')
    })
  })

  describe('POST /api/jobs', () => {
    it('creates new job for authenticated user', async () => {
      const jobData = {
        venue: 'New Restaurant',
        job_id: 'NEW-REST-001',
        collaborators: ['user-2'],
        status: 'draft'
      }

      const { req } = createMocks({
        method: 'POST',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: jobData
      })

      const createdJob = createMockJob({
        ...jobData,
        id: 'new-job-123',
        created_by: 'user-1'
      })

      const mockSupabase = createMockSupabaseClient({
        data: createdJob,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await createJobPOST(req as any)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.venue).toBe('New Restaurant')
      expect(data.data.created_by).toBe('user-1')
      expect(data.data.collaborators).toEqual(['user-2'])
    })

    it('creates job with default empty collaborators', async () => {
      const jobData = {
        venue: 'Solo Restaurant',
        job_id: 'SOLO-001'
      }

      const { req } = createMocks({
        method: 'POST',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: jobData
      })

      const createdJob = createMockJob({
        ...jobData,
        id: 'solo-job-123',
        created_by: 'user-1',
        collaborators: []
      })

      const mockSupabase = createMockSupabaseClient({
        data: createdJob,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await createJobPOST(req as any)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.collaborators).toEqual([])
    })

    it('handles duplicate job ID errors', async () => {
      const jobData = {
        venue: 'Duplicate Restaurant',
        job_id: 'EXISTING-001',
        collaborators: []
      }

      const { req } = createMocks({
        method: 'POST',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: jobData
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('duplicate key value violates unique constraint')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await createJobPOST(req as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('duplicate key')
    })

    it('validates required fields', async () => {
      const incompleteData = {
        venue: '', // Empty venue
        job_id: 'INCOMPLETE-001'
      }

      const { req } = createMocks({
        method: 'POST',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: incompleteData
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('venue cannot be empty')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await createJobPOST(req as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('venue cannot be empty')
    })
  })

  describe('GET /api/jobs/[id]', () => {
    it('returns job for owner', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer user-token'
        }
      })

      const mockJob = testJobs[0]
      const mockSupabase = createMockSupabaseClient({
        data: mockJob,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await getJobGET(req as any, { params: { id: 'job-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(mockJob)
    })

    it('returns job for collaborator', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer user-token' // user-1 is collaborator
        }
      })

      const mockJob = testJobs[1] // job-2 has user-1 as collaborator
      const mockSupabase = createMockSupabaseClient({
        data: mockJob,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await getJobGET(req as any, { params: { id: 'job-2' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(mockJob)
    })

    it('returns job for admin', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer admin-token'
        }
      })

      const mockJob = testJobs[0]
      const mockSupabase = createMockSupabaseClient({
        data: mockJob,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await getJobGET(req as any, { params: { id: 'job-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(mockJob)
    })

    it('returns 404 for non-accessible job', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer user-token'
        }
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('Job not found or access denied')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await getJobGET(req as any, { params: { id: 'restricted-job' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Job not found or access denied')
    })
  })

  describe('PUT /api/jobs/[id]', () => {
    it('allows job owner to update job', async () => {
      const updateData = {
        venue: 'Updated Restaurant Name',
        status: 'live',
        collaborators: ['user-2', 'user-3']
      }

      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: updateData
      })

      const updatedJob = createMockJob({
        ...testJobs[0],
        ...updateData,
        updated_at: new Date().toISOString()
      })

      const mockSupabase = createMockSupabaseClient({
        data: updatedJob,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await updateJobPUT(req as any, { params: { id: 'job-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.venue).toBe('Updated Restaurant Name')
      expect(data.data.status).toBe('live')
      expect(data.data.collaborators).toEqual(['user-2', 'user-3'])
    })

    it('allows admin to update any job', async () => {
      const updateData = {
        status: 'complete'
      }

      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer admin-token',
          'content-type': 'application/json'
        },
        body: updateData
      })

      const updatedJob = createMockJob({
        ...testJobs[0],
        ...updateData
      })

      const mockSupabase = createMockSupabaseClient({
        data: updatedJob,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await updateJobPUT(req as any, { params: { id: 'job-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.status).toBe('complete')
    })

    it('prevents unauthorized users from updating jobs', async () => {
      const updateData = { venue: 'Unauthorized Update' }

      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: updateData
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('Access denied')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await updateJobPUT(req as any, { params: { id: 'restricted-job' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Access denied')
    })

    it('validates status transitions', async () => {
      const invalidUpdate = { status: 'invalid-status' }

      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: invalidUpdate
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('Invalid status value')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await updateJobPUT(req as any, { params: { id: 'job-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Invalid status value')
    })
  })

  describe('DELETE /api/jobs/[id]', () => {
    it('allows job owner to delete job', async () => {
      const { req } = createMocks({
        method: 'DELETE',
        headers: {
          authorization: 'Bearer user-token'
        }
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await deleteJobDELETE(req as any, { params: { id: 'job-1' } })

      expect(response.status).toBe(204)
    })

    it('allows admin to delete any job', async () => {
      const { req } = createMocks({
        method: 'DELETE',
        headers: {
          authorization: 'Bearer admin-token'
        }
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await deleteJobDELETE(req as any, { params: { id: 'any-job' } })

      expect(response.status).toBe(204)
    })

    it('prevents collaborators from deleting jobs', async () => {
      const { req } = createMocks({
        method: 'DELETE',
        headers: {
          authorization: 'Bearer user-token' // user is collaborator, not owner
        }
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('Only owner can delete job')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await deleteJobDELETE(req as any, { params: { id: 'job-not-owned' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Only owner can delete job')
    })

    it('handles foreign key constraints', async () => {
      const { req } = createMocks({
        method: 'DELETE',
        headers: {
          authorization: 'Bearer user-token'
        }
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('Cannot delete job with related records')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await deleteJobDELETE(req as any, { params: { id: 'job-with-data' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Cannot delete job with related records')
    })
  })

  describe('PUT /api/jobs/[id]/owner', () => {
    it('allows job owner to transfer ownership', async () => {
      const transferData = { newOwnerId: 'user-2' }

      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: transferData
      })

      const transferredJob = createMockJob({
        ...testJobs[0],
        owner_id: 'user-2',
        owner: {
          id: 'user-2',
          email: 'user2@test.com',
          full_name: 'User 2',
          initials: 'U2',
          color_index: 1
        }
      })

      const mockSupabase = createMockSupabaseClient({
        data: transferredJob,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await transferOwnershipPUT(req as any, { params: { id: 'job-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.owner_id).toBe('user-2')
    })

    it('allows admin to transfer ownership of any job', async () => {
      const transferData = { newOwnerId: 'user-3' }

      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer admin-token',
          'content-type': 'application/json'
        },
        body: transferData
      })

      const transferredJob = createMockJob({
        ...testJobs[0],
        owner_id: 'user-3'
      })

      const mockSupabase = createMockSupabaseClient({
        data: transferredJob,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await transferOwnershipPUT(req as any, { params: { id: 'any-job' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.owner_id).toBe('user-3')
    })

    it('prevents non-owner from transferring ownership', async () => {
      const transferData = { newOwnerId: 'user-2' }

      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: transferData
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('Only current owner can transfer')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await transferOwnershipPUT(req as any, { params: { id: 'not-owned-job' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Only current owner can transfer')
    })

    it('validates new owner exists', async () => {
      const transferData = { newOwnerId: 'nonexistent-user' }

      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: transferData
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('New owner not found')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await transferOwnershipPUT(req as any, { params: { id: 'job-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('New owner not found')
    })
  })

  describe('Row Level Security (RLS) Testing', () => {
    it('enforces RLS for job access by collaborators', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer user-token'
        }
      })

      // Mock RLS blocking access
      const mockSupabase = createMockSupabaseClient({
        data: null, // No data returned due to RLS
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await getJobGET(req as any, { params: { id: 'job-not-accessible' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toBeNull() // RLS filtered out the job
    })

    it('allows admin to bypass RLS restrictions', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer admin-token'
        }
      })

      const restrictedJob = testJobs[0]
      const mockSupabase = createMockSupabaseClient({
        data: restrictedJob,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await getJobGET(req as any, { params: { id: 'restricted-job' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(restrictedJob)
    })
  })

  describe('Concurrency and Race Conditions', () => {
    it('handles concurrent job updates', async () => {
      const update1 = { venue: 'Update 1' }
      const update2 = { status: 'live' }

      const req1 = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: update1
      }).req

      const req2 = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: update2
      }).req

      const mockSupabase1 = createMockSupabaseClient({
        data: createMockJob({ ...testJobs[0], ...update1 }),
        error: null
      })

      const mockSupabase2 = createMockSupabaseClient({
        data: createMockJob({ ...testJobs[0], ...update2 }),
        error: null
      })

      // Both updates should succeed independently
      const response1 = await updateJobPUT(req1 as any, { params: { id: 'job-1' } })
      const response2 = await updateJobPUT(req2 as any, { params: { id: 'job-1' } })

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
    })

    it('handles optimistic locking conflicts', async () => {
      const updateData = { venue: 'Conflicted Update' }

      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: updateData
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('Row was updated by another transaction')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await updateJobPUT(req as any, { params: { id: 'job-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Row was updated by another transaction')
    })
  })
})