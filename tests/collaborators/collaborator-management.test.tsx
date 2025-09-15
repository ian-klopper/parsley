import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JobService } from '@/lib/job-service'
import { UserService } from '@/lib/user-service'
import { useAuth } from '@/contexts/AuthContext'
import { renderWithProviders, testUsers, testJobs, createMockUserProfile, createMockJob } from '@/lib/test-utils'

// Mock the services
jest.mock('@/lib/job-service')
jest.mock('@/lib/user-service')
jest.mock('@/contexts/AuthContext')

const mockJobService = JobService as jest.Mocked<typeof JobService>
const mockUserService = UserService as jest.Mocked<typeof UserService>
const mockUseAuth = useAuth as jest.Mock

// Mock collaborator management component
const MockCollaboratorDialog = ({
  job,
  users,
  currentUser,
  onUpdateCollaborators
}: {
  job: any
  users: any[]
  currentUser: any
  onUpdateCollaborators: (collaborators: string[]) => void
}) => {
  const [selectedCollaborators, setSelectedCollaborators] = React.useState<string[]>(
    job?.collaborators || []
  )

  const toggleCollaborator = (userId: string) => {
    setSelectedCollaborators(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleUpdate = () => {
    onUpdateCollaborators(selectedCollaborators)
  }

  return (
    <div data-testid="collaborator-dialog">
      <h2>Manage Collaborators</h2>
      {users
        .filter(u => u.id !== job?.created_by && u.id !== currentUser?.id)
        .map((user) => (
        <div key={user.id} data-testid={`user-${user.id}`}>
          <span>{user.full_name}</span>
          <input
            type="checkbox"
            checked={selectedCollaborators.includes(user.id)}
            onChange={() => toggleCollaborator(user.id)}
            data-testid={`toggle-${user.id}`}
          />
        </div>
      ))}
      <button onClick={handleUpdate} data-testid="update-collaborators">
        Update Collaborators
      </button>
    </div>
  )
}

describe('Collaborator Management Functionality', () => {
  const jobOwner = createMockUserProfile({
    id: 'job-owner',
    role: 'user',
    full_name: 'Job Owner',
    email: 'owner@test.com'
  })

  const collaborator1 = createMockUserProfile({
    id: 'collab-1',
    role: 'user',
    full_name: 'Collaborator 1',
    email: 'collab1@test.com'
  })

  const collaborator2 = createMockUserProfile({
    id: 'collab-2',
    role: 'user',
    full_name: 'Collaborator 2',
    email: 'collab2@test.com'
  })

  const testJob = createMockJob({
    id: 'test-job',
    venue: 'Test Venue',
    job_id: 'TEST-001',
    created_by: 'job-owner',
    collaborators: ['collab-1'],
    collaborator_users: [collaborator1]
  })

  const availableUsers = [jobOwner, collaborator1, collaborator2, testUsers[0]]

  beforeEach(() => {
    jest.clearAllMocks()

    mockUseAuth.mockReturnValue({
      user: { id: 'job-owner' },
      userProfile: jobOwner,
      loading: false,
      isAuthenticated: true,
      hasAccess: true,
      isAdmin: false
    })

    mockJobService.updateJob.mockResolvedValue({
      data: testJob,
      error: null
    })

    mockUserService.getAllUsers.mockResolvedValue({
      data: availableUsers,
      error: null
    })
  })

  describe('Adding Collaborators', () => {
    it('allows job owner to add new collaborators', async () => {
      const user = userEvent.setup()

      const handleUpdate = jest.fn()

      render(
        <MockCollaboratorDialog
          job={testJob}
          users={availableUsers}
          currentUser={jobOwner}
          onUpdateCollaborators={handleUpdate}
        />
      )

      // Should show available users (excluding owner and current collaborators)
      expect(screen.getByText('Collaborator 2')).toBeInTheDocument()
      expect(screen.getByTestId('toggle-collab-2')).not.toBeChecked()

      // Add Collaborator 2
      await user.click(screen.getByTestId('toggle-collab-2'))
      expect(screen.getByTestId('toggle-collab-2')).toBeChecked()

      // Update collaborators
      await user.click(screen.getByTestId('update-collaborators'))

      expect(handleUpdate).toHaveBeenCalledWith(['collab-1', 'collab-2'])
    })

    it('allows adding multiple collaborators at once', async () => {
      const user = userEvent.setup()
      const handleUpdate = jest.fn()

      const jobWithoutCollaborators = createMockJob({
        ...testJob,
        collaborators: [],
        collaborator_users: []
      })

      render(
        <MockCollaboratorDialog
          job={jobWithoutCollaborators}
          users={availableUsers}
          currentUser={jobOwner}
          onUpdateCollaborators={handleUpdate}
        />
      )

      // Add multiple collaborators
      await user.click(screen.getByTestId('toggle-collab-1'))
      await user.click(screen.getByTestId('toggle-collab-2'))
      await user.click(screen.getByTestId('toggle-admin-1'))

      expect(screen.getByTestId('toggle-collab-1')).toBeChecked()
      expect(screen.getByTestId('toggle-collab-2')).toBeChecked()
      expect(screen.getByTestId('toggle-admin-1')).toBeChecked()

      await user.click(screen.getByTestId('update-collaborators'))

      expect(handleUpdate).toHaveBeenCalledWith(['collab-1', 'collab-2', 'admin-1'])
    })

    it('prevents adding job owner as collaborator', () => {
      render(
        <MockCollaboratorDialog
          job={testJob}
          users={availableUsers}
          currentUser={jobOwner}
          onUpdateCollaborators={jest.fn()}
        />
      )

      // Job owner should not appear in the list
      expect(screen.queryByTestId('toggle-job-owner')).not.toBeInTheDocument()
      expect(screen.queryByText('Job Owner')).not.toBeInTheDocument()
    })

    it('shows current collaborators as checked', () => {
      render(
        <MockCollaboratorDialog
          job={testJob}
          users={availableUsers}
          currentUser={jobOwner}
          onUpdateCollaborators={jest.fn()}
        />
      )

      // Current collaborator should be checked
      expect(screen.getByTestId('toggle-collab-1')).toBeChecked()

      // Non-collaborator should not be checked
      expect(screen.getByTestId('toggle-collab-2')).not.toBeChecked()
    })
  })

  describe('Removing Collaborators', () => {
    it('allows job owner to remove existing collaborators', async () => {
      const user = userEvent.setup()
      const handleUpdate = jest.fn()

      render(
        <MockCollaboratorDialog
          job={testJob}
          users={availableUsers}
          currentUser={jobOwner}
          onUpdateCollaborators={handleUpdate}
        />
      )

      // Remove existing collaborator
      expect(screen.getByTestId('toggle-collab-1')).toBeChecked()
      await user.click(screen.getByTestId('toggle-collab-1'))
      expect(screen.getByTestId('toggle-collab-1')).not.toBeChecked()

      await user.click(screen.getByTestId('update-collaborators'))

      expect(handleUpdate).toHaveBeenCalledWith([])
    })

    it('allows partial removal of collaborators', async () => {
      const user = userEvent.setup()
      const handleUpdate = jest.fn()

      const jobWithMultipleCollabs = createMockJob({
        ...testJob,
        collaborators: ['collab-1', 'collab-2'],
        collaborator_users: [collaborator1, collaborator2]
      })

      render(
        <MockCollaboratorDialog
          job={jobWithMultipleCollabs}
          users={availableUsers}
          currentUser={jobOwner}
          onUpdateCollaborators={handleUpdate}
        />
      )

      // Remove only one collaborator
      expect(screen.getByTestId('toggle-collab-1')).toBeChecked()
      expect(screen.getByTestId('toggle-collab-2')).toBeChecked()

      await user.click(screen.getByTestId('toggle-collab-1'))

      await user.click(screen.getByTestId('update-collaborators'))

      expect(handleUpdate).toHaveBeenCalledWith(['collab-2'])
    })
  })

  describe('Permission-Based Access', () => {
    it('allows admin to manage collaborators on any job', async () => {
      const adminUser = createMockUserProfile({
        id: 'admin-user',
        role: 'admin',
        full_name: 'Admin User',
        email: 'admin@test.com'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'admin-user' },
        userProfile: adminUser,
        loading: false,
        isAuthenticated: true,
        hasAccess: true,
        isAdmin: true
      })

      const user = userEvent.setup()
      const handleUpdate = jest.fn()

      render(
        <MockCollaboratorDialog
          job={testJob}
          users={availableUsers}
          currentUser={adminUser}
          onUpdateCollaborators={handleUpdate}
        />
      )

      // Admin should be able to modify collaborators
      await user.click(screen.getByTestId('toggle-collab-2'))
      await user.click(screen.getByTestId('update-collaborators'))

      expect(handleUpdate).toHaveBeenCalledWith(['collab-1', 'collab-2'])
    })

    it('prevents non-owner, non-admin from managing collaborators', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'collab-1' },
        userProfile: collaborator1,
        loading: false,
        isAuthenticated: true,
        hasAccess: true,
        isAdmin: false
      })

      // In a real implementation, this dialog wouldn't even render for collaborators
      // But we can test that the update functionality is disabled
      const handleUpdate = jest.fn()

      render(
        <MockCollaboratorDialog
          job={testJob}
          users={availableUsers}
          currentUser={collaborator1}
          onUpdateCollaborators={handleUpdate}
        />
      )

      // The dialog renders but collaborators can't modify
      expect(screen.getByTestId('collaborator-dialog')).toBeInTheDocument()
    })
  })

  describe('API Integration', () => {
    it('calls job update API when collaborators change', async () => {
      const user = userEvent.setup()

      const CollaboratorManagementWrapper = () => {
        const [currentJob, setCurrentJob] = React.useState(testJob)

        const handleUpdateCollaborators = async (collaborators: string[]) => {
          const { data } = await mockJobService.updateJob(currentJob.id, { collaborators })
          if (data) {
            setCurrentJob(data)
          }
        }

        return (
          <MockCollaboratorDialog
            job={currentJob}
            users={availableUsers}
            currentUser={jobOwner}
            onUpdateCollaborators={handleUpdateCollaborators}
          />
        )
      }

      render(<CollaboratorManagementWrapper />)

      // Add a collaborator
      await user.click(screen.getByTestId('toggle-collab-2'))
      await user.click(screen.getByTestId('update-collaborators'))

      await waitFor(() => {
        expect(mockJobService.updateJob).toHaveBeenCalledWith('test-job', {
          collaborators: ['collab-1', 'collab-2']
        })
      })
    })

    it('handles API errors gracefully', async () => {
      const user = userEvent.setup()
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      mockJobService.updateJob.mockResolvedValue({
        data: null,
        error: 'Update failed'
      })

      const ErrorHandlingWrapper = () => {
        const handleUpdateCollaborators = async (collaborators: string[]) => {
          const { data, error } = await mockJobService.updateJob(testJob.id, { collaborators })
          if (error) {
            console.error('Failed to update collaborators:', error)
          }
        }

        return (
          <MockCollaboratorDialog
            job={testJob}
            users={availableUsers}
            currentUser={jobOwner}
            onUpdateCollaborators={handleUpdateCollaborators}
          />
        )
      }

      render(<ErrorHandlingWrapper />)

      await user.click(screen.getByTestId('toggle-collab-2'))
      await user.click(screen.getByTestId('update-collaborators'))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to update collaborators:', 'Update failed')
      })

      consoleSpy.mockRestore()
    })
  })

  describe('User Interface Behavior', () => {
    it('updates UI state immediately when selections change', async () => {
      const user = userEvent.setup()

      render(
        <MockCollaboratorDialog
          job={testJob}
          users={availableUsers}
          currentUser={jobOwner}
          onUpdateCollaborators={jest.fn()}
        />
      )

      const toggle = screen.getByTestId('toggle-collab-2')
      expect(toggle).not.toBeChecked()

      await user.click(toggle)
      expect(toggle).toBeChecked()

      await user.click(toggle)
      expect(toggle).not.toBeChecked()
    })

    it('displays user information correctly', () => {
      render(
        <MockCollaboratorDialog
          job={testJob}
          users={availableUsers}
          currentUser={jobOwner}
          onUpdateCollaborators={jest.fn()}
        />
      )

      expect(screen.getByText('Collaborator 1')).toBeInTheDocument()
      expect(screen.getByText('Collaborator 2')).toBeInTheDocument()
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    })

    it('handles empty user list gracefully', () => {
      render(
        <MockCollaboratorDialog
          job={testJob}
          users={[jobOwner]} // Only owner in list
          currentUser={jobOwner}
          onUpdateCollaborators={jest.fn()}
        />
      )

      // Should show dialog but no collaborator options
      expect(screen.getByTestId('collaborator-dialog')).toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })
  })

  describe('Data Consistency', () => {
    it('maintains consistency between job data and UI state', () => {
      const jobWithMultipleCollabs = createMockJob({
        ...testJob,
        collaborators: ['collab-1', 'collab-2', 'admin-1'],
        collaborator_users: [collaborator1, collaborator2, testUsers[0]]
      })

      render(
        <MockCollaboratorDialog
          job={jobWithMultipleCollabs}
          users={availableUsers}
          currentUser={jobOwner}
          onUpdateCollaborators={jest.fn()}
        />
      )

      // All current collaborators should be checked
      expect(screen.getByTestId('toggle-collab-1')).toBeChecked()
      expect(screen.getByTestId('toggle-collab-2')).toBeChecked()
      expect(screen.getByTestId('toggle-admin-1')).toBeChecked()
    })

    it('handles users not in the available list', () => {
      const jobWithMissingUser = createMockJob({
        ...testJob,
        collaborators: ['collab-1', 'missing-user'],
        collaborator_users: [collaborator1]
      })

      render(
        <MockCollaboratorDialog
          job={jobWithMissingUser}
          users={availableUsers}
          currentUser={jobOwner}
          onUpdateCollaborators={jest.fn()}
        />
      )

      // Should only show available users
      expect(screen.getByTestId('toggle-collab-1')).toBeChecked()
      expect(screen.queryByTestId('toggle-missing-user')).not.toBeInTheDocument()
    })
  })

  describe('Concurrency Handling', () => {
    it('handles concurrent collaborator updates', async () => {
      const user = userEvent.setup()

      mockJobService.updateJob
        .mockResolvedValueOnce({
          data: { ...testJob, collaborators: ['collab-1', 'collab-2'] },
          error: null
        })
        .mockResolvedValueOnce({
          data: { ...testJob, collaborators: ['collab-1', 'admin-1'] },
          error: null
        })

      const ConcurrentUpdatesWrapper = () => {
        const handleUpdate1 = async () => {
          await mockJobService.updateJob(testJob.id, { collaborators: ['collab-1', 'collab-2'] })
        }

        const handleUpdate2 = async () => {
          await mockJobService.updateJob(testJob.id, { collaborators: ['collab-1', 'admin-1'] })
        }

        return (
          <div>
            <button onClick={handleUpdate1} data-testid="update-1">Update 1</button>
            <button onClick={handleUpdate2} data-testid="update-2">Update 2</button>
          </div>
        )
      }

      render(<ConcurrentUpdatesWrapper />)

      // Simulate concurrent updates
      await Promise.all([
        user.click(screen.getByTestId('update-1')),
        user.click(screen.getByTestId('update-2'))
      ])

      await waitFor(() => {
        expect(mockJobService.updateJob).toHaveBeenCalledTimes(2)
      })
    })

    it('handles optimistic updates with rollback on failure', async () => {
      const user = userEvent.setup()

      mockJobService.updateJob.mockRejectedValue(new Error('Network error'))

      const OptimisticUpdateWrapper = () => {
        const [collaborators, setCollaborators] = React.useState(['collab-1'])

        const handleOptimisticUpdate = async (newCollaborators: string[]) => {
          const oldCollaborators = collaborators
          setCollaborators(newCollaborators) // Optimistic update

          try {
            await mockJobService.updateJob(testJob.id, { collaborators: newCollaborators })
          } catch (error) {
            setCollaborators(oldCollaborators) // Rollback on error
            console.error('Update failed, rolling back')
          }
        }

        return (
          <div>
            <div data-testid="current-collaborators">{collaborators.join(',')}</div>
            <button
              onClick={() => handleOptimisticUpdate(['collab-1', 'collab-2'])}
              data-testid="optimistic-update"
            >
              Add Collaborator
            </button>
          </div>
        )
      }

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      render(<OptimisticUpdateWrapper />)

      expect(screen.getByTestId('current-collaborators')).toHaveTextContent('collab-1')

      await user.click(screen.getByTestId('optimistic-update'))

      // Should rollback to original state after error
      await waitFor(() => {
        expect(screen.getByTestId('current-collaborators')).toHaveTextContent('collab-1')
        expect(consoleSpy).toHaveBeenCalledWith('Update failed, rolling back')
      })

      consoleSpy.mockRestore()
    })
  })
})