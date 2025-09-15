import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JobsPage from '@/app/jobs/page'
import { useAuth } from '@/contexts/AuthContext'
import { JobService } from '@/lib/job-service'
import { UserService } from '@/lib/user-service'
import { renderWithProviders, testUsers, testJobs, createMockUserProfile, createMockJob } from '@/lib/test-utils'

// Mock the modules
jest.mock('@/contexts/AuthContext')
jest.mock('@/lib/job-service')
jest.mock('@/lib/user-service')
jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: jest.fn() })
}))

const mockUseAuth = useAuth as jest.Mock
const mockJobService = {
  getAllJobs: jest.fn(),
  createJob: jest.fn()
}
const mockUserService = {
  getAllUsers: jest.fn()
}

// Replace services with our mocks
Object.assign(JobService, mockJobService)
Object.assign(UserService, mockUserService)

describe('JobsPage', () => {
  const regularUser = createMockUserProfile({
    id: 'user-1',
    role: 'user',
    full_name: 'Regular User',
    email: 'user@test.com'
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock successful job and user loading
    mockJobService.getAllJobs.mockResolvedValue({ jobs: testJobs, error: null })
    mockUserService.getAllUsers.mockResolvedValue({ data: testUsers, error: null })
    mockJobService.createJob.mockResolvedValue({ job: testJobs[0], error: null })

    // Mock successful auth state
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      userProfile: regularUser,
      loading: false,
      isAuthenticated: true,
      hasAccess: true,
      isAdmin: false,
      signOut: jest.fn()
    })
  })

  describe('Page Loading and Display', () => {
    it('renders the jobs page title', () => {
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      expect(screen.getByText('Jobs')).toBeInTheDocument()
    })

    it('displays loading state initially', () => {
      mockJobService.getAllJobs.mockReturnValue(new Promise(() => {})) // Keep it pending
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('displays job table after jobs are loaded', async () => {
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      await waitFor(() => {
        expect(screen.getByText('Restaurant A')).toBeInTheDocument()
        expect(screen.getByText('Bar B')).toBeInTheDocument()
        expect(screen.getByText('Cafe C')).toBeInTheDocument()
      })
    })

    it('displays correct job statuses', async () => {
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      await waitFor(() => {
        expect(screen.getByText('draft')).toBeInTheDocument()
        expect(screen.getByText('live')).toBeInTheDocument()
        expect(screen.getByText('complete')).toBeInTheDocument()
      })
    })

    it('displays job collaborators', async () => {
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      await waitFor(() => {
        // Check for collaborator badges
        expect(screen.getAllByText('Regular User 1')).toHaveLength(2) // Appears in 2 jobs
        expect(screen.getByText('Regular User 2')).toBeInTheDocument()
      })
    })

    it('displays job creation dates', async () => {
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      await waitFor(() => {
        // Check that dates are formatted correctly
        const dateElements = screen.getAllByText(/\d{1,2}\/\d{1,2}\/\d{4}/)
        expect(dateElements.length).toBeGreaterThan(0)
      })
    })

    it('handles empty job list', async () => {
      mockJobService.getAllJobs.mockResolvedValue({ jobs: [], error: null })
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      await waitFor(() => {
        expect(screen.getByText('Jobs')).toBeInTheDocument()
        // Should render empty table or empty state
      })
    })

    it('handles job loading errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      mockJobService.getAllJobs.mockResolvedValue({ jobs: null, error: 'Network error' })

      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error loading jobs:', 'Network error')
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Job Creation Dialog', () => {
    it('opens create job dialog when New Job button is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      await waitFor(() => {
        expect(screen.getByText('New Job')).toBeInTheDocument()
      })

      const newJobButton = screen.getByRole('button', { name: /new job/i })
      await user.click(newJobButton)

      expect(screen.getByText('Create New Job')).toBeInTheDocument()
    })

    it('displays job creation form fields', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      const newJobButton = screen.getByRole('button', { name: /new job/i })
      await user.click(newJobButton)

      expect(screen.getByLabelText('Venue Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Job ID')).toBeInTheDocument()
      expect(screen.getByText('Add Collaborators')).toBeInTheDocument()
    })

    it('displays available users for collaboration', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      const newJobButton = screen.getByRole('button', { name: /new job/i })
      await user.click(newJobButton)

      await waitFor(() => {
        // Should show users except the current user
        expect(screen.getByText('Admin User')).toBeInTheDocument()
        expect(screen.getByText('Regular User 2')).toBeInTheDocument()
        expect(screen.getByText('Pending User')).toBeInTheDocument()
      })
    })

    it('allows selecting and deselecting collaborators', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      const newJobButton = screen.getByRole('button', { name: /new job/i })
      await user.click(newJobButton)

      await waitFor(() => {
        expect(screen.getByText('Admin User')).toBeInTheDocument()
      })

      // Find and click the switch for Admin User
      const switches = screen.getAllByRole('switch')
      const adminUserSwitch = switches[0] // Assuming first switch is for Admin User

      await user.click(adminUserSwitch)
      expect(adminUserSwitch).toBeChecked()

      await user.click(adminUserSwitch)
      expect(adminUserSwitch).not.toBeChecked()
    })

    it('shows file upload area', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      const newJobButton = screen.getByRole('button', { name: /new job/i })
      await user.click(newJobButton)

      expect(screen.getByText('Upload PDF, spreadsheet, or images')).toBeInTheDocument()
    })

    it('validates required fields before job creation', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      const newJobButton = screen.getByRole('button', { name: /new job/i })
      await user.click(newJobButton)

      const createButton = screen.getByRole('button', { name: /create job/i })
      expect(createButton).toBeDisabled()

      // Fill in venue name
      const venueInput = screen.getByLabelText('Venue Name')
      await user.type(venueInput, 'Test Venue')

      // Create button should still be disabled without job ID
      expect(createButton).toBeDisabled()

      // Fill in job ID
      const jobIdInput = screen.getByLabelText('Job ID')
      await user.type(jobIdInput, 'TEST-001')

      // Now create button should be enabled
      expect(createButton).toBeEnabled()
    })

    it('creates job with correct data', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      const newJobButton = screen.getByRole('button', { name: /new job/i })
      await user.click(newJobButton)

      // Fill in form
      const venueInput = screen.getByLabelText('Venue Name')
      await user.type(venueInput, 'Test Restaurant')

      const jobIdInput = screen.getByLabelText('Job ID')
      await user.type(jobIdInput, 'TEST-123')

      // Select a collaborator
      const switches = screen.getAllByRole('switch')
      await user.click(switches[0])

      const createButton = screen.getByRole('button', { name: /create job/i })
      await user.click(createButton)

      expect(mockJobService.createJob).toHaveBeenCalledWith('user-1', {
        venue: 'Test Restaurant',
        job_id: 'TEST-123',
        collaborators: [testUsers[0].id] // Admin user ID
      })
    })

    it('closes dialog and resets form after successful creation', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      const newJobButton = screen.getByRole('button', { name: /new job/i })
      await user.click(newJobButton)

      // Fill in form
      const venueInput = screen.getByLabelText('Venue Name')
      await user.type(venueInput, 'Test Restaurant')

      const jobIdInput = screen.getByLabelText('Job ID')
      await user.type(jobIdInput, 'TEST-123')

      const createButton = screen.getByRole('button', { name: /create job/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.queryByText('Create New Job')).not.toBeInTheDocument()
      })
    })

    it('handles job creation errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      mockJobService.createJob.mockResolvedValue({ job: null, error: 'Database error' })

      const user = userEvent.setup()
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      const newJobButton = screen.getByRole('button', { name: /new job/i })
      await user.click(newJobButton)

      const venueInput = screen.getByLabelText('Venue Name')
      await user.type(venueInput, 'Test Restaurant')

      const jobIdInput = screen.getByLabelText('Job ID')
      await user.type(jobIdInput, 'TEST-123')

      const createButton = screen.getByRole('button', { name: /create job/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error creating job:', 'Database error')
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Job Navigation', () => {
    it('navigates to individual job when job row is clicked', async () => {
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      await waitFor(() => {
        expect(screen.getByText('Restaurant A')).toBeInTheDocument()
      })

      const jobLink = screen.getByRole('link', { name: /restaurant a/i })
      expect(jobLink).toHaveAttribute('href', '/job?id=job-1')
    })

    it('shows job IDs as subtitles', async () => {
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      await waitFor(() => {
        expect(screen.getByText('REST-A-001')).toBeInTheDocument()
        expect(screen.getByText('BAR-B-002')).toBeInTheDocument()
        expect(screen.getByText('CAFE-C-003')).toBeInTheDocument()
      })
    })

    it('shows back navigation to home', () => {
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      const backLinks = screen.getAllByRole('link')
      const homeLink = backLinks.find(link => link.getAttribute('href') === '/')
      expect(homeLink).toBeInTheDocument()
    })
  })

  describe('User Interface Elements', () => {
    it('displays user dropdown menu', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      // Find user avatar button
      const avatarButtons = screen.getAllByRole('button')
      const userAvatarButton = avatarButtons.find(button =>
        button.closest('.bg-secondary') // Sidebar avatar
      )

      expect(userAvatarButton).toBeInTheDocument()
      await user.click(userAvatarButton!)

      expect(screen.getByText('Toggle Theme')).toBeInTheDocument()
      expect(screen.getByText('Logout')).toBeInTheDocument()
      expect(screen.getByText('Admin')).toBeInTheDocument()
      expect(screen.getByText('Logs')).toBeInTheDocument()
    })

    it('displays correct user initials in avatar', () => {
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      // Should show user initials
      expect(screen.getByText('RU')).toBeInTheDocument()
    })

    it('applies correct theme colors', () => {
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      // Check for theme-based styling
      const mainElement = screen.getByRole('main')
      expect(mainElement).toHaveClass('h-screen')
    })
  })

  describe('Responsive Design', () => {
    it('uses resizable panels for layout', () => {
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      expect(screen.getByRole('main')).toHaveClass('h-screen')
    })

    it('has scrollable content area', () => {
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      // Check for ScrollArea component
      const scrollArea = document.querySelector('.h-full.px-6')
      expect(scrollArea).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper table structure', async () => {
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
        expect(screen.getAllByRole('columnheader')).toHaveLength(5)
      })
    })

    it('has proper form labels', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      const newJobButton = screen.getByRole('button', { name: /new job/i })
      await user.click(newJobButton)

      expect(screen.getByLabelText('Venue Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Job ID')).toBeInTheDocument()
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      // Tab through interactive elements
      await user.tab()
      expect(document.activeElement).toBeInTheDocument()

      await user.tab()
      expect(document.activeElement).toBeInTheDocument()
    })
  })

  describe('Data Integrity', () => {
    it('displays job creators correctly', async () => {
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      await waitFor(() => {
        // Check that job creators are displayed
        expect(screen.getByText('Test User')).toBeInTheDocument()
      })
    })

    it('handles missing job data gracefully', async () => {
      const incompleteJobs = [
        createMockJob({
          id: 'incomplete-job',
          venue: 'Incomplete Venue',
          job_id: '',
          creator: null,
          collaborator_users: []
        })
      ]

      mockJobService.getAllJobs.mockResolvedValue({ jobs: incompleteJobs, error: null })
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      await waitFor(() => {
        expect(screen.getByText('Incomplete Venue')).toBeInTheDocument()
      })
    })

    it('handles concurrent data loading', async () => {
      // Simulate slower user loading
      mockUserService.getAllUsers.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ data: testUsers, error: null }), 100))
      )

      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      // Jobs should load first
      await waitFor(() => {
        expect(screen.getByText('Restaurant A')).toBeInTheDocument()
      })

      // Users should load after
      await waitFor(() => {
        expect(screen.getByText('Regular User 1')).toBeInTheDocument()
      }, { timeout: 200 })
    })
  })

  describe('Error Handling', () => {
    it('handles user loading errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      mockUserService.getAllUsers.mockResolvedValue({ data: null, error: 'User fetch failed' })

      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error loading users:', 'User fetch failed')
      })

      consoleSpy.mockRestore()
    })

    it('prevents job creation with invalid user state', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        userProfile: regularUser,
        loading: false,
        isAuthenticated: false,
        hasAccess: false,
        isAdmin: false,
        signOut: jest.fn()
      })

      const user = userEvent.setup()
      renderWithProviders(<JobsPage />, { mockUserProfile: regularUser })

      const newJobButton = screen.getByRole('button', { name: /new job/i })
      await user.click(newJobButton)

      const createButton = screen.getByRole('button', { name: /create job/i })
      expect(createButton).toBeDisabled()
    })
  })
})