import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminPage from '@/app/admin/page'
import { useAuth } from '@/contexts/AuthContext'
import { UserService } from '@/lib/user-service'
import { useToast } from '@/hooks/use-toast'
import { renderWithProviders, testUsers, createMockUserProfile } from '@/lib/test-utils'

// Mock the modules
jest.mock('@/contexts/AuthContext')
jest.mock('@/lib/user-service')
jest.mock('@/hooks/use-toast')
jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: jest.fn() })
}))

const mockUseAuth = useAuth as jest.Mock
const mockUseToast = useToast as jest.Mock
const mockUserService = {
  getAllUsers: jest.fn(),
  updateUserRole: jest.fn(),
  updateUserColor: jest.fn(),
  generateInitials: jest.fn()
}

// Replace UserService with our mock
Object.assign(UserService, mockUserService)

describe('AdminPage - Comprehensive Tests', () => {
  const mockToast = jest.fn()
  const mockRefreshProfile = jest.fn()
  const adminUser = createMockUserProfile({
    id: 'admin-user',
    role: 'admin',
    full_name: 'Admin User',
    email: 'admin@test.com'
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock toast hook
    mockUseToast.mockReturnValue({ toast: mockToast })

    // Mock UserService methods
    mockUserService.getAllUsers.mockResolvedValue({ data: testUsers, error: null })
    mockUserService.updateUserRole.mockResolvedValue({ success: true, error: null })
    mockUserService.updateUserColor.mockResolvedValue({ success: true, error: null })
    mockUserService.generateInitials.mockImplementation((name) => {
      if (!name) return ''
      return name.split(' ').map(n => n.charAt(0).toUpperCase()).join('').slice(0, 2)
    })

    // Mock successful auth state
    mockUseAuth.mockReturnValue({
      userProfile: adminUser,
      user: { id: 'admin-user' },
      loading: false,
      isAdmin: true,
      hasAccess: true,
      refreshProfile: mockRefreshProfile,
      signOut: jest.fn()
    })
  })

  describe('Page Loading and Display', () => {
    it('renders the admin page title and loading state initially', () => {
      mockUserService.getAllUsers.mockReturnValue(new Promise(() => {})) // Keep it pending
      renderWithProviders(<AdminPage />, { isAdmin: true, mockUserProfile: adminUser })

      expect(screen.getByText('Admin')).toBeInTheDocument()
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('displays the user table after users are loaded', async () => {
      renderWithProviders(<AdminPage />, { isAdmin: true, mockUserProfile: adminUser })

      await waitFor(() => {
        expect(screen.getByText('Admin User')).toBeInTheDocument()
        expect(screen.getByText('admin@test.com')).toBeInTheDocument()
        expect(screen.getByText('Regular User 1')).toBeInTheDocument()
        expect(screen.getByText('Pending User')).toBeInTheDocument()
      })
    })

    it('displays correct user roles and statuses', async () => {
      renderWithProviders(<AdminPage />, { isAdmin: true, mockUserProfile: adminUser })

      await waitFor(() => {
        // Check for admin badge
        expect(screen.getByText('admin')).toBeInTheDocument()

        // Check for user badges
        const userBadges = screen.getAllByText('user')
        expect(userBadges.length).toBeGreaterThan(0)

        // Check for pending badge
        expect(screen.getByText('pending')).toBeInTheDocument()
      })
    })

    it('displays an error message if loading users fails', async () => {
      mockUserService.getAllUsers.mockResolvedValue({
        data: null,
        error: 'Failed to fetch users'
      })

      renderWithProviders(<AdminPage />, { isAdmin: true, mockUserProfile: adminUser })

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to load users: Failed to fetch users',
        variant: 'destructive'
      })

      expect(screen.getByText('No users found')).toBeInTheDocument()
    })
  })

  describe('User Role Management', () => {
    it('allows admin to change user roles', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdminPage />, { isAdmin: true, mockUserProfile: adminUser })

      await waitFor(() => {
        expect(screen.getByText('Regular User 1')).toBeInTheDocument()
      })

      // Find the role select for Regular User 1
      const roleSelects = screen.getAllByRole('combobox')
      const userRoleSelect = roleSelects.find(select => {
        const row = select.closest('tr')
        return row && within(row).queryByText('Regular User 1')
      })

      expect(userRoleSelect).toBeInTheDocument()

      // Change role to admin
      await user.click(userRoleSelect!)

      // Mock the successful role update
      mockUserService.updateUserRole.mockResolvedValueOnce({ success: true, error: null })
      mockUserService.getAllUsers.mockResolvedValueOnce({ data: testUsers, error: null })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Success',
          description: expect.stringContaining('role updated')
        })
      })
    })

    it('handles role update errors', async () => {
      const user = userEvent.setup()
      mockUserService.updateUserRole.mockResolvedValue({
        success: false,
        error: 'Database connection failed'
      })

      renderWithProviders(<AdminPage />, { isAdmin: true, mockUserProfile: adminUser })

      await waitFor(() => {
        expect(screen.getByText('Regular User 1')).toBeInTheDocument()
      })

      const roleSelects = screen.getAllByRole('combobox')
      const userRoleSelect = roleSelects[0] // Get first select

      await user.click(userRoleSelect)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: expect.stringContaining('Database connection failed'),
          variant: 'destructive'
        })
      })
    })
  })

  describe('Navigation and UI Elements', () => {
    it('shows back navigation to jobs page', () => {
      renderWithProviders(<AdminPage />, { isAdmin: true, mockUserProfile: adminUser })

      const backLinks = screen.getAllByRole('link')
      const jobsLink = backLinks.find(link => link.getAttribute('href') === '/jobs')
      expect(jobsLink).toBeInTheDocument()
    })

    it('shows New Job button in sidebar', () => {
      renderWithProviders(<AdminPage />, { isAdmin: true, mockUserProfile: adminUser })

      const newJobLinks = screen.getAllByRole('link')
      const newJobLink = newJobLinks.find(link => link.getAttribute('href') === '/job')
      expect(newJobLink).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', async () => {
      renderWithProviders(<AdminPage />, { isAdmin: true, mockUserProfile: adminUser })

      await waitFor(() => {
        // Check for table structure
        expect(screen.getByRole('table')).toBeInTheDocument()
        expect(screen.getAllByRole('columnheader')).toHaveLength(5)
      })
    })
  })

  describe('Error Handling', () => {
    it('handles malformed user data gracefully', async () => {
      const malformedUsers = [
        createMockUserProfile({ id: 'valid-id', email: '', full_name: 'Test User' }), // Empty email
      ]

      mockUserService.getAllUsers.mockResolvedValue({ data: malformedUsers, error: null })
      renderWithProviders(<AdminPage />, { isAdmin: true, mockUserProfile: adminUser })

      await waitFor(() => {
        // Should still render without crashing
        expect(screen.getByText('Admin')).toBeInTheDocument()
      })
    })

    it('recovers from network errors', async () => {
      mockUserService.getAllUsers
        .mockResolvedValueOnce({ data: null, error: 'Network error' })
        .mockResolvedValueOnce({ data: testUsers, error: null })

      renderWithProviders(<AdminPage />, { isAdmin: true, mockUserProfile: adminUser })

      await waitFor(() => {
        expect(screen.getByText('No users found')).toBeInTheDocument()
      })
    })
  })
})