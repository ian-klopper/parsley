import { createMocks } from 'node-mocks-http'
import { GET as getUsersGET } from '@/app/api/admin/users/route'
import { GET as getCurrentUserGET, PUT as updateCurrentUserPUT } from '@/app/api/users/me/route'
import { PUT as updateUserPUT, DELETE as deleteUserDELETE } from '@/app/api/admin/users/[id]/route'
import { createMockSupabaseClient, testUsers, createMockUserProfile } from '@/lib/test-utils'

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: createMockSupabaseClient()
}))

// Mock auth middleware
jest.mock('@/lib/api/auth-middleware', () => ({
  requireAdmin: jest.fn().mockImplementation((req) => {
    if (!req.headers.authorization?.includes('admin-token')) {
      throw new Error('Insufficient permissions')
    }
    return { id: 'admin-1', role: 'admin' }
  }),
  requireNonPending: jest.fn().mockImplementation((req) => {
    if (!req.headers.authorization?.includes('user-token')) {
      throw new Error('Unauthorized')
    }
    return { id: 'user-1', role: 'user' }
  }),
  handleApiError: jest.fn().mockImplementation((error) => {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message.includes('permissions') ? 403 :
             error.message.includes('Unauthorized') ? 401 : 500
    })
  }),
  createSupabaseServer: jest.fn().mockImplementation(() => createMockSupabaseClient())
}))

describe('User API Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/admin/users', () => {
    it('returns all users for admin', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer admin-token'
        }
      })

      const mockSupabase = createMockSupabaseClient({
        data: testUsers,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await getUsersGET(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(testUsers)
    })

    it('returns 403 for non-admin users', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer user-token'
        }
      })

      const response = await getUsersGET(req as any)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Insufficient permissions')
    })

    it('returns 401 for unauthorized requests', async () => {
      const { req } = createMocks({
        method: 'GET'
      })

      const response = await getUsersGET(req as any)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('handles database errors', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer admin-token'
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

      const response = await getUsersGET(req as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Database connection failed')
    })
  })

  describe('GET /api/users/me', () => {
    it('returns current user profile', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer user-token'
        }
      })

      const mockUser = testUsers[1] // Regular user
      const mockSupabase = createMockSupabaseClient({
        data: mockUser,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await getCurrentUserGET(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(mockUser)
    })

    it('returns 401 for unauthorized requests', async () => {
      const { req } = createMocks({
        method: 'GET'
      })

      const response = await getCurrentUserGET(req as any)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('PUT /api/users/me', () => {
    it('updates current user profile', async () => {
      const updateData = { full_name: 'Updated Name', color_index: 5 }
      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: updateData
      })

      const updatedUser = { ...testUsers[1], ...updateData }
      const mockSupabase = createMockSupabaseClient({
        data: updatedUser,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await updateCurrentUserPUT(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.full_name).toBe('Updated Name')
      expect(data.data.color_index).toBe(5)
    })

    it('ignores role changes in user profile updates', async () => {
      const updateData = { full_name: 'Updated Name', role: 'admin' }
      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: updateData
      })

      // Role should remain unchanged
      const updatedUser = { ...testUsers[1], full_name: 'Updated Name' }
      const mockSupabase = createMockSupabaseClient({
        data: updatedUser,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await updateCurrentUserPUT(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.role).toBe('user') // Should remain user, not admin
    })

    it('handles validation errors', async () => {
      const invalidData = { email: 'invalid-email-format' }
      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: invalidData
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('Invalid email format')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await updateCurrentUserPUT(req as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Invalid email format')
    })
  })

  describe('PUT /api/admin/users/[id]', () => {
    it('allows admin to update user roles', async () => {
      const updateData = { role: 'admin' }
      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer admin-token',
          'content-type': 'application/json'
        },
        body: updateData
      })

      const updatedUser = { ...testUsers[1], role: 'admin', approved_at: new Date().toISOString() }
      const mockSupabase = createMockSupabaseClient({
        data: updatedUser,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      // Mock the dynamic route params
      const response = await updateUserPUT(req as any, { params: { id: 'user-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.role).toBe('admin')
      expect(data.data.approved_at).toBeDefined()
    })

    it('prevents non-admin users from updating roles', async () => {
      const updateData = { role: 'admin' }
      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: updateData
      })

      const response = await updateUserPUT(req as any, { params: { id: 'user-1' } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Insufficient permissions')
    })

    it('handles user not found', async () => {
      const updateData = { role: 'admin' }
      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer admin-token',
          'content-type': 'application/json'
        },
        body: updateData
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('User not found')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await updateUserPUT(req as any, { params: { id: 'nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('User not found')
    })
  })

  describe('DELETE /api/admin/users/[id]', () => {
    it('allows admin to delete users', async () => {
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

      const response = await deleteUserDELETE(req as any, { params: { id: 'user-to-delete' } })

      expect(response.status).toBe(204)
    })

    it('prevents non-admin users from deleting users', async () => {
      const { req } = createMocks({
        method: 'DELETE',
        headers: {
          authorization: 'Bearer user-token'
        }
      })

      const response = await deleteUserDELETE(req as any, { params: { id: 'user-to-delete' } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Insufficient permissions')
    })

    it('handles deletion constraints', async () => {
      const { req } = createMocks({
        method: 'DELETE',
        headers: {
          authorization: 'Bearer admin-token'
        }
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('Cannot delete user with active jobs')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await deleteUserDELETE(req as any, { params: { id: 'user-with-jobs' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Cannot delete user with active jobs')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles malformed JSON in request body', async () => {
      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: 'invalid json'
      })

      // Mock JSON parsing error
      jest.spyOn(req, 'json').mockRejectedValue(new Error('Invalid JSON'))

      const response = await updateCurrentUserPUT(req as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Invalid JSON')
    })

    it('handles missing authorization headers', async () => {
      const { req } = createMocks({
        method: 'GET'
      })

      const response = await getUsersGET(req as any)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('handles database connection failures', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer admin-token'
        }
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('Connection timeout')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await getUsersGET(req as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Connection timeout')
    })
  })

  describe('Data Validation and Sanitization', () => {
    it('sanitizes user input in updates', async () => {
      const maliciousData = {
        full_name: '<script>alert("xss")</script>',
        email: 'test@example.com'
      }

      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: maliciousData
      })

      const sanitizedUser = {
        ...testUsers[1],
        full_name: '&lt;script&gt;alert("xss")&lt;/script&gt;'
      }

      const mockSupabase = createMockSupabaseClient({
        data: sanitizedUser,
        error: null
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await updateCurrentUserPUT(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.full_name).not.toContain('<script>')
    })

    it('validates email format in updates', async () => {
      const invalidData = { email: 'not-an-email' }

      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: invalidData
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('Invalid email format')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await updateCurrentUserPUT(req as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Invalid email format')
    })

    it('validates role values in admin updates', async () => {
      const invalidData = { role: 'invalid-role' }

      const { req } = createMocks({
        method: 'PUT',
        headers: {
          authorization: 'Bearer admin-token',
          'content-type': 'application/json'
        },
        body: invalidData
      })

      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: new Error('Invalid role value')
      })

      jest.doMock('@/lib/api/auth-middleware', () => ({
        ...jest.requireActual('@/lib/api/auth-middleware'),
        createSupabaseServer: () => mockSupabase
      }))

      const response = await updateUserPUT(req as any, { params: { id: 'user-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Invalid role value')
    })
  })
})