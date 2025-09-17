import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { UserService } from '@/lib/user-service'
import { supabase } from '@/lib/supabase'
import { createMockUserProfile, createMockUser } from '@/lib/test-utils'

// Mock dependencies
jest.mock('@/lib/supabase')
jest.mock('@/lib/user-service')

const mockSupabase = supabase as jest.Mocked<typeof supabase>
const mockUserService = UserService as jest.Mocked<typeof UserService>

const TestComponent = () => {
  const auth = useAuth()

  return (
    <div>
      <div data-testid="loading">{auth.loading ? 'loading' : 'not loading'}</div>
      <div data-testid="user">{auth.user ? auth.user.email : 'no user'}</div>
      <div data-testid="profile">{auth.userProfile ? auth.userProfile.full_name : 'no profile'}</div>
      <div data-testid="has-access">{auth.hasAccess ? 'has access' : 'no access'}</div>
      <div data-testid="is-admin">{auth.isAdmin ? 'is admin' : 'not admin'}</div>
      <button onClick={auth.signOut} data-testid="sign-out">Sign Out</button>
      <button onClick={auth.refreshProfile} data-testid="refresh">Refresh Profile</button>
    </div>
  )
}

describe('AuthContext', () => {
  const mockUser = createMockUser({
    id: 'user-123',
    email: 'test@example.com'
  })

  const mockUserProfile = createMockUserProfile({
    id: 'user-123',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'user'
  })

  const mockAdminProfile = createMockUserProfile({
    id: 'admin-123',
    email: 'admin@example.com',
    full_name: 'Admin User',
    role: 'admin'
  })

  const mockPendingProfile = createMockUserProfile({
    id: 'pending-123',
    email: 'pending@example.com',
    full_name: 'Pending User',
    role: 'pending'
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Default mocks
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    })

    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn()
        }
      }
    })

    mockUserService.getCurrentUser.mockResolvedValue({
      user: null,
      error: null
    })
  })

  describe('Initial State', () => {
    it('starts with loading state', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      expect(screen.getByTestId('loading')).toHaveTextContent('loading')
      expect(screen.getByTestId('user')).toHaveTextContent('no user')
      expect(screen.getByTestId('profile')).toHaveTextContent('no profile')
      expect(screen.getByTestId('has-access')).toHaveTextContent('no access')
      expect(screen.getByTestId('is-admin')).toHaveTextContent('not admin')
    })

    it('updates loading state after session check', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not loading')
      })
    })
  })

  describe('Session Management', () => {
    it('sets user when session exists', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: mockUser,
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            token_type: 'bearer'
          }
        },
        error: null
      })

      mockUserService.getCurrentUser.mockResolvedValue({
        user: mockUserProfile,
        error: null
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
      })
    })

    it('clears user when no session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('no user')
        expect(screen.getByTestId('loading')).toHaveTextContent('not loading')
      })
    })

    it('handles auth state changes', async () => {
      let authChangeCallback: ((event: string, session: any) => void) | undefined

      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn()
            }
          }
        }
      })

      mockUserService.getCurrentUser.mockResolvedValue({
        user: mockUserProfile,
        error: null
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // Simulate sign in event
      act(() => {
        authChangeCallback?.('SIGNED_IN', {
          user: mockUser,
          access_token: 'token',
          refresh_token: 'refresh',
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: 'bearer'
        })
      })

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
      })

      // Simulate sign out event
      act(() => {
        authChangeCallback?.('SIGNED_OUT', null)
      })

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('no user')
      })
    })
  })

  describe('Profile Management', () => {
    beforeEach(() => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: mockUser,
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            token_type: 'bearer'
          }
        },
        error: null
      })
    })

    it('loads user profile when user is authenticated', async () => {
      mockUserService.getCurrentUser.mockResolvedValue({
        user: mockUserProfile,
        error: null
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('profile')).toHaveTextContent('Test User')
        expect(screen.getByTestId('has-access')).toHaveTextContent('has access')
        expect(screen.getByTestId('is-admin')).toHaveTextContent('not admin')
      })
    })

    it('sets admin flags for admin users', async () => {
      mockUserService.getCurrentUser.mockResolvedValue({
        user: mockAdminProfile,
        error: null
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('profile')).toHaveTextContent('Admin User')
        expect(screen.getByTestId('has-access')).toHaveTextContent('has access')
        expect(screen.getByTestId('is-admin')).toHaveTextContent('is admin')
      })
    })

    it('denies access for pending users', async () => {
      mockUserService.getCurrentUser.mockResolvedValue({
        user: mockPendingProfile,
        error: null
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('profile')).toHaveTextContent('Pending User')
        expect(screen.getByTestId('has-access')).toHaveTextContent('no access')
        expect(screen.getByTestId('is-admin')).toHaveTextContent('not admin')
      })
    })

    it('handles profile loading errors', async () => {
      mockUserService.getCurrentUser.mockResolvedValue({
        user: null,
        error: 'Network error'
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('profile')).toHaveTextContent('no profile')
        expect(screen.getByTestId('has-access')).toHaveTextContent('no access')
        expect(screen.getByTestId('is-admin')).toHaveTextContent('not admin')
      })
    })

    it('refreshes profile when refreshProfile is called', async () => {
      mockUserService.getCurrentUser
        .mockResolvedValueOnce({
          user: mockUserProfile,
          error: null
        })
        .mockResolvedValueOnce({
          user: { ...mockUserProfile, full_name: 'Updated User' },
          error: null
        })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('profile')).toHaveTextContent('Test User')
      })

      const refreshButton = screen.getByTestId('refresh')
      refreshButton.click()

      await waitFor(() => {
        expect(screen.getByTestId('profile')).toHaveTextContent('Updated User')
      })

      expect(mockUserService.getCurrentUser).toHaveBeenCalledTimes(2)
    })

    it('clears profile when user logs out', async () => {
      mockUserService.getCurrentUser.mockResolvedValue({
        user: mockUserProfile,
        error: null
      })

      let authChangeCallback: ((event: string, session: any) => void) | undefined

      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn()
            }
          }
        }
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('profile')).toHaveTextContent('Test User')
      })

      // Simulate sign out
      act(() => {
        authChangeCallback?.('SIGNED_OUT', null)
      })

      await waitFor(() => {
        expect(screen.getByTestId('profile')).toHaveTextContent('no profile')
        expect(screen.getByTestId('has-access')).toHaveTextContent('no access')
        expect(screen.getByTestId('is-admin')).toHaveTextContent('not admin')
      })
    })
  })

  describe('Sign Out Functionality', () => {
    it('calls supabase signOut when signOut is triggered', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      const signOutButton = screen.getByTestId('sign-out')
      signOutButton.click()

      await waitFor(() => {
        expect(mockSupabase.auth.signOut).toHaveBeenCalled()
      })
    })

    it('handles signOut errors gracefully', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: new Error('Sign out failed')
      })

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      const signOutButton = screen.getByTestId('sign-out')
      signOutButton.click()

      await waitFor(() => {
        expect(mockSupabase.auth.signOut).toHaveBeenCalled()
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Subscription Cleanup', () => {
    it('unsubscribes from auth changes on unmount', () => {
      const mockUnsubscribe = jest.fn()

      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: {
          subscription: {
            unsubscribe: mockUnsubscribe
          }
        }
      })

      const { unmount } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('handles session loading errors', async () => {
      mockSupabase.auth.getSession.mockRejectedValue(new Error('Session error'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not loading')
      })

      consoleSpy.mockRestore()
    })

    it('handles profile refresh errors', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: mockUser,
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            token_type: 'bearer'
          }
        },
        error: null
      })

      mockUserService.getCurrentUser
        .mockResolvedValueOnce({
          user: mockUserProfile,
          error: null
        })
        .mockResolvedValueOnce({
          user: null,
          error: 'Refresh failed'
        })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('profile')).toHaveTextContent('Test User')
      })

      const refreshButton = screen.getByTestId('refresh')
      refreshButton.click()

      await waitFor(() => {
        expect(screen.getByTestId('profile')).toHaveTextContent('no profile')
      })
    })
  })

  describe('Context Usage', () => {
    it('throws error when used outside of AuthProvider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(<TestComponent />)
      }).toThrow('useAuth must be used within an AuthProvider')

      consoleSpy.mockRestore()
    })
  })

  describe('Performance and Memory', () => {
    it('memoizes refresh function to prevent unnecessary re-renders', async () => {
      let renderCount = 0

      const CountingComponent = () => {
        const { refreshProfile } = useAuth()
        renderCount++

        return (
          <div>
            <div data-testid="render-count">{renderCount}</div>
            <button onClick={refreshProfile}>Refresh</button>
          </div>
        )
      }

      mockUserService.getCurrentUser.mockResolvedValue({
        user: mockUserProfile,
        error: null
      })

      render(
        <AuthProvider>
          <CountingComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('render-count')).toHaveTextContent('1')
      })

      // Multiple calls should not cause additional renders
      const refreshButton = screen.getByRole('button')
      refreshButton.click()
      refreshButton.click()

      await waitFor(() => {
        // Should not increase due to memoization
        expect(screen.getByTestId('render-count')).toHaveTextContent('1')
      })
    })

    it('handles rapid auth state changes without memory leaks', async () => {
      let authChangeCallback: ((event: string, session: any) => void) | undefined

      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn()
            }
          }
        }
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // Simulate rapid auth changes
      for (let i = 0; i < 10; i++) {
        act(() => {
          authChangeCallback?.('SIGNED_IN', {
            user: { ...mockUser, id: `user-${i}` },
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            token_type: 'bearer'
          })
        })

        act(() => {
          authChangeCallback?.('SIGNED_OUT', null)
        })
      }

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('no user')
      })
    })
  })
})