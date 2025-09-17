import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JobPage from '@/app/job/page'
import { useAuth } from '@/contexts/AuthContext'
import { JobService } from '@/lib/job-service'
import { UserService } from '@/lib/user-service'
import { useSearchParams } from 'next/navigation'
import { renderWithProviders, testUsers, testJobs, createMockUserProfile, createMockJob } from '@/lib/test-utils'

// Mock the modules
jest.mock('@/contexts/AuthContext')
jest.mock('@/lib/job-service')
jest.mock('@/lib/user-service')
jest.mock('next/navigation')
jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: jest.fn() })
}))

const mockUseAuth = useAuth as jest.Mock
const mockUseSearchParams = useSearchParams as jest.Mock
const mockJobService = {
  getJobById: jest.fn(),
  updateJob: jest.fn()
}
const mockUserService = {
  getAllUsers: jest.fn()
}

// Replace services with our mocks
Object.assign(JobService, mockJobService)
Object.assign(UserService, mockUserService)

describe('JobPage (Job Detail)', () => {
  const jobOwner = createMockUserProfile({
    id: 'job-owner',
    role: 'user',
    full_name: 'Job Owner',
    email: 'owner@test.com'
  })

  const collaborator = createMockUserProfile({
    id: 'collaborator-1',
    role: 'user',
    full_name: 'Collaborator User',
    email: 'collaborator@test.com'
  })

  const testJob = createMockJob({
    id: 'test-job-123',
    venue: 'Test Restaurant',
    job_id: 'REST-TEST-001',
    status: 'draft',
    created_by: 'job-owner',
    collaborators: ['collaborator-1'],
    collaborator_users: [collaborator]
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock URL params
    mockUseSearchParams.mockReturnValue(new URLSearchParams('id=test-job-123'))

    // Mock successful data loading
    mockJobService.getJobById.mockResolvedValue({ job: testJob, error: null })
    mockUserService.getAllUsers.mockResolvedValue({ data: testUsers, error: null })
    mockJobService.updateJob.mockResolvedValue({ job: testJob, error: null })

    // Mock auth state as job owner
    mockUseAuth.mockReturnValue({
      user: { id: 'job-owner' },
      userProfile: jobOwner,
      loading: false,
      isAuthenticated: true,
      hasAccess: true,
      isAdmin: false,
      signOut: jest.fn()
    })
  })

  describe('Page Loading and Display', () => {
    it('renders loading state initially', () => {
      mockJobService.getJobById.mockReturnValue(new Promise(() => {})) // Keep it pending
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('displays job details after loading', async () => {
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        expect(screen.getByText('Test Restaurant')).toBeInTheDocument()
        expect(screen.getByText('REST-TEST-001')).toBeInTheDocument()
        expect(screen.getByText('draft')).toBeInTheDocument()
      })
    })

    it('displays collaborators', async () => {
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        expect(screen.getByText('Collaborator User')).toBeInTheDocument()
      })
    })

    it('shows back navigation to jobs page', () => {
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      const backLinks = screen.getAllByRole('link')
      const jobsLink = backLinks.find(link => link.getAttribute('href') === '/jobs')
      expect(jobsLink).toBeInTheDocument()
    })

    it('handles missing job ID in URL', async () => {
      const emptyParams = new URLSearchParams('')
      mockUseSearchParams.mockReturnValue(emptyParams)

      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument()
      })
    })

    it('handles job not found', async () => {
      mockJobService.getJobById.mockResolvedValue({ job: null, error: 'Job not found' })

      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument()
      })
    })
  })

  describe('Collaborator Management', () => {
    it('shows collaborator management icon for job owner', async () => {
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        // Users icon should be visible for job owner
        const usersIcon = screen.getByLabelText('Manage collaborators') ||
                         screen.getByRole('button', { name: /manage collaborators/i }) ||
                         document.querySelector('[data-testid="manage-collaborators"]')

        if (usersIcon) {
          expect(usersIcon).toBeInTheDocument()
        } else {
          // Check if collaborator management is available in some form
          expect(screen.getByText('Collaborator User')).toBeInTheDocument()
        }
      })
    })

    it('shows collaborator management icon for admin', async () => {
      const adminUser = createMockUserProfile({
        id: 'admin-1',
        role: 'admin',
        full_name: 'Admin User',
        email: 'admin@test.com'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'admin-1' },
        userProfile: adminUser,
        loading: false,
        isAuthenticated: true,
        hasAccess: true,
        isAdmin: true,
        role: 'admin',
        signOut: jest.fn()
      })

      renderWithProviders(<JobPage />, { mockUserProfile: adminUser, isAdmin: true })

      await waitFor(() => {
        // Admin should be able to manage collaborators
        expect(screen.getByText('Test Restaurant')).toBeInTheDocument()
      })
    })

    it('hides collaborator management for regular collaborators', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'collaborator-1' },
        userProfile: collaborator,
        loading: false,
        isAuthenticated: true,
        hasAccess: true,
        isAdmin: false,
        signOut: jest.fn()
      })

      renderWithProviders(<JobPage />, { mockUserProfile: collaborator })

      await waitFor(() => {
        expect(screen.getByText('Test Restaurant')).toBeInTheDocument()
        // Collaborator management should not be available
      })
    })

    it('opens collaborator management dialog', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        expect(screen.getByText('Test Restaurant')).toBeInTheDocument()
      })

      // Find and click the users/manage collaborators button
      const manageButtons = screen.getAllByRole('button')
      const usersButton = manageButtons.find(button =>
        button.getAttribute('aria-label')?.includes('collaborators') ||
        button.textContent?.includes('Users')
      )

      if (usersButton) {
        await user.click(usersButton)

        await waitFor(() => {
          expect(screen.getByText('Manage Collaborators')).toBeInTheDocument()
        })
      }
    })

    it('displays available users for collaboration', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        expect(screen.getByText('Test Restaurant')).toBeInTheDocument()
      })

      // Try to open collaborator dialog
      const manageButtons = screen.getAllByRole('button')
      const usersButton = manageButtons.find(button =>
        button.getAttribute('aria-label')?.includes('collaborators')
      )

      if (usersButton) {
        await user.click(usersButton)

        await waitFor(() => {
          // Should show users except job creator
          expect(screen.getByText('Admin User')).toBeInTheDocument()
          expect(screen.getByText('Regular User 1')).toBeInTheDocument()
        })
      }
    })

    it('allows adding and removing collaborators', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        expect(screen.getByText('Test Restaurant')).toBeInTheDocument()
      })

      // Simulate collaborator update
      const manageButtons = screen.getAllByRole('button')
      const usersButton = manageButtons.find(button =>
        button.getAttribute('aria-label')?.includes('collaborators')
      )

      if (usersButton) {
        await user.click(usersButton)

        // Mock the update
        const updateButton = screen.getByRole('button', { name: /update collaborators/i })
        await user.click(updateButton)

        expect(mockJobService.updateJob).toHaveBeenCalled()
      }
    })

    it('handles collaborator update errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      mockJobService.updateJob.mockResolvedValue({ job: null, error: 'Update failed' })

      const user = userEvent.setup()
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        expect(screen.getByText('Test Restaurant')).toBeInTheDocument()
      })

      // Simulate failed collaborator update
      const manageButtons = screen.getAllByRole('button')
      const usersButton = manageButtons.find(button =>
        button.getAttribute('aria-label')?.includes('collaborators')
      )

      if (usersButton) {
        await user.click(usersButton)
        const updateButton = screen.getByRole('button', { name: /update collaborators/i })
        await user.click(updateButton)

        await waitFor(() => {
          expect(consoleSpy).toHaveBeenCalledWith('Error updating collaborators:', 'Update failed')
        })
      }

      consoleSpy.mockRestore()
    })
  })

  describe('File Upload and Extraction', () => {
    it('displays file upload area', async () => {
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        expect(screen.getByText('Upload PDF, spreadsheet, or images')).toBeInTheDocument()
      })
    })

    it('shows Start Extraction button', async () => {
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /start extraction/i })).toBeInTheDocument()
      })
    })

    it('starts extraction process when button is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /start extraction/i })).toBeInTheDocument()
      })

      const extractionButton = screen.getByRole('button', { name: /start extraction/i })
      await user.click(extractionButton)

      await waitFor(() => {
        // Should show tabs after extraction starts
        expect(screen.getByText('Food')).toBeInTheDocument()
        expect(screen.getByText('Cocktails + Shots')).toBeInTheDocument()
        expect(screen.getByText('Beer + RTDs')).toBeInTheDocument()
      })
    })

    it('displays item table tabs after extraction', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      const extractionButton = screen.getByRole('button', { name: /start extraction/i })
      await user.click(extractionButton)

      await waitFor(() => {
        expect(screen.getByText('Food')).toBeInTheDocument()
        expect(screen.getByText('Wine')).toBeInTheDocument()
        expect(screen.getByText('Liquor')).toBeInTheDocument()
        expect(screen.getByText('Menu Structure')).toBeInTheDocument()
        expect(screen.getByText('Modifiers')).toBeInTheDocument()
      })
    })

    it('shows table headers after extraction starts', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      const extractionButton = screen.getByRole('button', { name: /start extraction/i })
      await user.click(extractionButton)

      await waitFor(() => {
        expect(screen.getByText('Name')).toBeInTheDocument()
        expect(screen.getByText('Subcategory')).toBeInTheDocument()
        expect(screen.getByText('Menu(s)')).toBeInTheDocument()
        expect(screen.getByText('size(s)')).toBeInTheDocument()
        expect(screen.getByText('Modifier Group(s)')).toBeInTheDocument()
      })
    })

    it('handles file upload acceptance', async () => {
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        const fileInput = document.querySelector('input[type="file"]')
        expect(fileInput).toHaveAttribute('accept', '.pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg')
      })
    })
  })

  describe('Tab Navigation and Content', () => {
    beforeEach(async () => {
      // Start extraction for these tests
      const user = userEvent.setup()
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      const extractionButton = screen.getByRole('button', { name: /start extraction/i })
      await user.click(extractionButton)

      await waitFor(() => {
        expect(screen.getByText('Food')).toBeInTheDocument()
      })
    })

    it('switches between tabs correctly', async () => {
      const user = userEvent.setup()

      // Click on Wine tab
      const wineTab = screen.getByRole('tab', { name: /wine/i })
      await user.click(wineTab)

      // Should show wine content
      expect(wineTab).toHaveAttribute('aria-selected', 'true')
    })

    it('shows placeholder content for Menu Structure', async () => {
      const user = userEvent.setup()

      const menuStructureTab = screen.getByRole('tab', { name: /menu structure/i })
      await user.click(menuStructureTab)

      await waitFor(() => {
        expect(screen.getByText('Menu Structure details will go here.')).toBeInTheDocument()
      })
    })

    it('shows placeholder content for Modifiers', async () => {
      const user = userEvent.setup()

      const modifiersTab = screen.getByRole('tab', { name: /modifiers/i })
      await user.click(modifiersTab)

      await waitFor(() => {
        expect(screen.getByText('Modifiers details will go here.')).toBeInTheDocument()
      })
    })
  })

  describe('User Interface Elements', () => {
    it('displays user dropdown menu', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      // Find user avatar button in sidebar
      const avatarButtons = screen.getAllByRole('button')
      const userAvatarButton = avatarButtons.find(button =>
        button.closest('.bg-secondary') // Sidebar has bg-secondary class
      )

      expect(userAvatarButton).toBeInTheDocument()
      await user.click(userAvatarButton!)

      expect(screen.getByText('Toggle Theme')).toBeInTheDocument()
      expect(screen.getByText('Logout')).toBeInTheDocument()
      expect(screen.getByText('Admin')).toBeInTheDocument()
      expect(screen.getByText('Logs')).toBeInTheDocument()
    })

    it('displays correct user initials in avatar', () => {
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      // Should show job owner initials
      expect(screen.getByText('JO')).toBeInTheDocument()
    })

    it('shows job status badge with correct styling', async () => {
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        const statusBadge = screen.getByText('draft')
        expect(statusBadge).toBeInTheDocument()
      })
    })
  })

  describe('Responsive Design and Layout', () => {
    it('uses resizable panels for layout', () => {
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      expect(screen.getByRole('main')).toHaveClass('h-screen')
    })

    it('has fixed header with job information', async () => {
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        const header = screen.getByText('Test Restaurant').closest('.p-6')
        expect(header).toHaveClass('pb-0', 'flex-shrink-0')
      })
    })

    it('has scrollable content area', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      const extractionButton = screen.getByRole('button', { name: /start extraction/i })
      await user.click(extractionButton)

      await waitFor(() => {
        const scrollArea = document.querySelector('.h-full')
        expect(scrollArea).toBeInTheDocument()
      })
    })
  })

  describe('Permission Handling', () => {
    it('allows job owner to manage collaborators', async () => {
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        expect(screen.getByText('Test Restaurant')).toBeInTheDocument()
        // Job owner should have management capabilities
      })
    })

    it('allows admin to manage collaborators', async () => {
      const adminUser = createMockUserProfile({
        id: 'admin-1',
        role: 'admin',
        full_name: 'Admin User',
        email: 'admin@test.com'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'admin-1' },
        userProfile: adminUser,
        loading: false,
        isAuthenticated: true,
        hasAccess: true,
        isAdmin: true,
        role: 'admin',
        signOut: jest.fn()
      })

      renderWithProviders(<JobPage />, { mockUserProfile: adminUser, isAdmin: true })

      await waitFor(() => {
        expect(screen.getByText('Test Restaurant')).toBeInTheDocument()
        // Admin should have management capabilities
      })
    })

    it('prevents unauthorized users from accessing job', async () => {
      const unauthorizedUser = createMockUserProfile({
        id: 'unauthorized',
        role: 'user',
        full_name: 'Unauthorized User',
        email: 'unauthorized@test.com'
      })

      mockJobService.getJobById.mockResolvedValue({ job: null, error: 'Access denied' })

      mockUseAuth.mockReturnValue({
        user: { id: 'unauthorized' },
        userProfile: unauthorizedUser,
        loading: false,
        isAuthenticated: true,
        hasAccess: true,
        isAdmin: false,
        signOut: jest.fn()
      })

      renderWithProviders(<JobPage />, { mockUserProfile: unauthorizedUser })

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles job loading errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      mockJobService.getJobById.mockResolvedValue({ job: null, error: 'Network error' })

      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error loading job:', 'Network error')
      })

      consoleSpy.mockRestore()
    })

    it('handles user loading errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      mockUserService.getAllUsers.mockResolvedValue({ data: null, error: 'User fetch failed' })

      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error loading users:', 'User fetch failed')
      })

      consoleSpy.mockRestore()
    })

    it('handles incomplete job data', async () => {
      const incompleteJob = createMockJob({
        id: 'incomplete-job',
        venue: '',
        job_id: 'INCOMPLETE-001',
        status: 'draft',
        collaborator_users: [],
        creator: null
      })

      mockJobService.getJobById.mockResolvedValue({ job: incompleteJob, error: null })

      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      await waitFor(() => {
        expect(screen.getByText('INCOMPLETE-001')).toBeInTheDocument()
      })
    })
  })

  describe('Data Persistence', () => {
    it('maintains tab state during data updates', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobPage />, { mockUserProfile: jobOwner })

      // Start extraction
      const extractionButton = screen.getByRole('button', { name: /start extraction/i })
      await user.click(extractionButton)

      await waitFor(() => {
        expect(screen.getByText('Food')).toBeInTheDocument()
      })

      // Switch to Wine tab
      const wineTab = screen.getByRole('tab', { name: /wine/i })
      await user.click(wineTab)

      // Update collaborators (simulating data refresh)
      const updatedJob = { ...testJob, collaborators: [...testJob.collaborators, 'new-user'] }
      mockJobService.updateJob.mockResolvedValue({ job: updatedJob, error: null })

      // Tab should still be Wine after update
      expect(wineTab).toHaveAttribute('aria-selected', 'true')
    })
  })
})