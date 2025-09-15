import { UserService } from './user-service'
import { apiClient } from './services/api-client'
import { createMockUserProfile, testUsers, mockApiResponses } from './test-utils'

// Mock the API client
jest.mock('./services/api-client')
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateInitials', () => {
    it('should generate initials from full name', () => {
      expect(UserService.generateInitials('John Doe')).toBe('JD')
      expect(UserService.generateInitials('Alice Bob Smith')).toBe('AB')
      expect(UserService.generateInitials('Mary')).toBe('M')
    })

    it('should handle empty or undefined names', () => {
      expect(UserService.generateInitials('')).toBe('')
      expect(UserService.generateInitials(undefined)).toBe('')
    })

    it('should handle names with extra spaces', () => {
      expect(UserService.generateInitials('  John   Doe  ')).toBe('JD')
      expect(UserService.generateInitials(' Alice ')).toBe('A')
    })

    it('should limit to 2 characters', () => {
      expect(UserService.generateInitials('First Second Third Fourth')).toBe('FS')
    })
  })

  describe('getCurrentUser', () => {
    it('should successfully fetch current user', async () => {
      const mockUser = createMockUserProfile()
      mockApiClient.getCurrentUser.mockResolvedValue({ data: mockUser })

      const result = await UserService.getCurrentUser()

      expect(mockApiClient.getCurrentUser).toHaveBeenCalledTimes(1)
      expect(result.data).toEqual(mockUser)
      expect(result.error).toBeNull()
    })

    it('should handle API errors', async () => {
      const errorMessage = 'Unauthorized'
      mockApiClient.getCurrentUser.mockRejectedValue(new Error(errorMessage))

      const result = await UserService.getCurrentUser()

      expect(result.data).toBeNull()
      expect(result.error).toBe(errorMessage)
    })

    it('should handle network errors', async () => {
      mockApiClient.getCurrentUser.mockRejectedValue(new Error('Network error'))

      const result = await UserService.getCurrentUser()

      expect(result.data).toBeNull()
      expect(result.error).toBe('Network error')
    })
  })

  describe('updateCurrentUser', () => {
    it('should successfully update current user', async () => {
      const updateData = { full_name: 'Updated Name' }
      const updatedUser = createMockUserProfile(updateData)
      mockApiClient.updateCurrentUser.mockResolvedValue({ data: updatedUser })

      const result = await UserService.updateCurrentUser(updateData)

      expect(mockApiClient.updateCurrentUser).toHaveBeenCalledWith(updateData)
      expect(result.data).toEqual(updatedUser)
      expect(result.error).toBeNull()
    })

    it('should handle validation errors', async () => {
      const updateData = { email: 'invalid-email' }
      mockApiClient.updateCurrentUser.mockRejectedValue(new Error('Invalid email format'))

      const result = await UserService.updateCurrentUser(updateData)

      expect(result.data).toBeNull()
      expect(result.error).toBe('Invalid email format')
    })
  })

  describe('getAllUsers', () => {
    it('should successfully fetch all users', async () => {
      mockApiClient.getAllUsers.mockResolvedValue({ data: testUsers })

      const result = await UserService.getAllUsers()

      expect(mockApiClient.getAllUsers).toHaveBeenCalledTimes(1)
      expect(result.data).toEqual(testUsers)
      expect(result.error).toBeNull()
    })

    it('should handle empty user list', async () => {
      mockApiClient.getAllUsers.mockResolvedValue({ data: [] })

      const result = await UserService.getAllUsers()

      expect(result.data).toEqual([])
      expect(result.error).toBeNull()
    })

    it('should handle permission denied errors', async () => {
      mockApiClient.getAllUsers.mockRejectedValue(new Error('Insufficient permissions'))

      const result = await UserService.getAllUsers()

      expect(result.data).toBeNull()
      expect(result.error).toBe('Insufficient permissions')
    })
  })

  describe('updateUser', () => {
    it('should successfully update user by admin', async () => {
      const userId = 'user-123'
      const updateData = { role: 'admin' as const }
      const updatedUser = createMockUserProfile({ ...updateData, id: userId })
      mockApiClient.updateUser.mockResolvedValue({ data: updatedUser })

      const result = await UserService.updateUser(userId, updateData)

      expect(mockApiClient.updateUser).toHaveBeenCalledWith(userId, updateData)
      expect(result.data).toEqual(updatedUser)
      expect(result.error).toBeNull()
    })

    it('should handle role change validation', async () => {
      const userId = 'user-123'
      const updateData = { role: 'invalid-role' as any }
      mockApiClient.updateUser.mockRejectedValue(new Error('Invalid role'))

      const result = await UserService.updateUser(userId, updateData)

      expect(result.data).toBeNull()
      expect(result.error).toBe('Invalid role')
    })

    it('should handle user not found errors', async () => {
      const userId = 'nonexistent-user'
      const updateData = { full_name: 'New Name' }
      mockApiClient.updateUser.mockRejectedValue(new Error('User not found'))

      const result = await UserService.updateUser(userId, updateData)

      expect(result.data).toBeNull()
      expect(result.error).toBe('User not found')
    })
  })

  describe('deleteUser', () => {
    it('should successfully delete user', async () => {
      const userId = 'user-to-delete'
      mockApiClient.deleteUser.mockResolvedValue(undefined)

      const result = await UserService.deleteUser(userId)

      expect(mockApiClient.deleteUser).toHaveBeenCalledWith(userId)
      expect(result.error).toBeNull()
    })

    it('should handle deletion failures', async () => {
      const userId = 'user-to-delete'
      mockApiClient.deleteUser.mockRejectedValue(new Error('Cannot delete user with active jobs'))

      const result = await UserService.deleteUser(userId)

      expect(result.error).toBe('Cannot delete user with active jobs')
    })

    it('should handle permission denied for deletion', async () => {
      const userId = 'user-to-delete'
      mockApiClient.deleteUser.mockRejectedValue(new Error('Insufficient permissions'))

      const result = await UserService.deleteUser(userId)

      expect(result.error).toBe('Insufficient permissions')
    })
  })

  describe('getActivityLogs', () => {
    const mockLogs = [
      {
        id: 'log-1',
        user_id: 'user-1',
        action: 'user.created',
        details: { email: 'test@example.com' },
        status: 'success' as const,
        created_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 'log-2',
        user_id: 'user-1',
        action: 'job.created',
        details: { job_id: 'TEST-001' },
        status: 'success' as const,
        created_at: '2024-01-01T01:00:00Z'
      }
    ]

    it('should fetch activity logs with default pagination', async () => {
      const mockResponse = {
        data: mockLogs,
        pagination: { page: 1, limit: 50, total: 2, totalPages: 1 }
      }
      mockApiClient.getActivityLogs.mockResolvedValue(mockResponse)

      const result = await UserService.getActivityLogs()

      expect(mockApiClient.getActivityLogs).toHaveBeenCalledWith(1, 50)
      expect(result.data).toEqual(mockLogs)
      expect(result.pagination).toEqual(mockResponse.pagination)
      expect(result.error).toBeNull()
    })

    it('should fetch activity logs with custom pagination', async () => {
      const mockResponse = {
        data: mockLogs.slice(0, 1),
        pagination: { page: 2, limit: 1, total: 2, totalPages: 2 }
      }
      mockApiClient.getActivityLogs.mockResolvedValue(mockResponse)

      const result = await UserService.getActivityLogs(2, 1)

      expect(mockApiClient.getActivityLogs).toHaveBeenCalledWith(2, 1)
      expect(result.data).toEqual(mockLogs.slice(0, 1))
      expect(result.pagination).toEqual(mockResponse.pagination)
    })

    it('should handle empty activity logs', async () => {
      const mockResponse = {
        data: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 }
      }
      mockApiClient.getActivityLogs.mockResolvedValue(mockResponse)

      const result = await UserService.getActivityLogs()

      expect(result.data).toEqual([])
      expect(result.error).toBeNull()
    })

    it('should handle activity log fetch errors', async () => {
      mockApiClient.getActivityLogs.mockRejectedValue(new Error('Database connection failed'))

      const result = await UserService.getActivityLogs()

      expect(result.data).toBeNull()
      expect(result.error).toBe('Database connection failed')
    })
  })

  describe('Error handling', () => {
    it('should handle non-Error exceptions', async () => {
      mockApiClient.getCurrentUser.mockRejectedValue('String error')

      const result = await UserService.getCurrentUser()

      expect(result.data).toBeNull()
      expect(result.error).toBe('Failed to fetch user profile')
    })

    it('should handle undefined errors', async () => {
      mockApiClient.getCurrentUser.mockRejectedValue(undefined)

      const result = await UserService.getCurrentUser()

      expect(result.data).toBeNull()
      expect(result.error).toBe('Failed to fetch user profile')
    })
  })

  describe('Integration scenarios', () => {
    it('should handle user role upgrade flow', async () => {
      // Simulate upgrading a pending user to regular user
      const pendingUser = createMockUserProfile({ role: 'pending' })
      const upgradedUser = createMockUserProfile({ role: 'user', approved_at: '2024-01-01T00:00:00Z' })

      mockApiClient.updateUser.mockResolvedValue({ data: upgradedUser })

      const result = await UserService.updateUser(pendingUser.id, { role: 'user' })

      expect(result.data?.role).toBe('user')
      expect(result.data?.approved_at).toBeDefined()
      expect(result.error).toBeNull()
    })

    it('should handle concurrent user updates', async () => {
      const userId = 'user-123'
      const update1 = { full_name: 'Name 1' }
      const update2 = { color_index: 5 }

      const user1 = createMockUserProfile(update1)
      const user2 = createMockUserProfile(update2)

      mockApiClient.updateUser
        .mockResolvedValueOnce({ data: user1 })
        .mockResolvedValueOnce({ data: user2 })

      const [result1, result2] = await Promise.all([
        UserService.updateUser(userId, update1),
        UserService.updateUser(userId, update2)
      ])

      expect(result1.data?.full_name).toBe('Name 1')
      expect(result2.data?.color_index).toBe(5)
      expect(result1.error).toBeNull()
      expect(result2.error).toBeNull()
    })
  })
})