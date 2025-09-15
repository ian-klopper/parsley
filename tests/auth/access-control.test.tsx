import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { AccessControl, withAuth } from '@/components/AccessControl'
import { useAuth } from '@/contexts/AuthContext'
import { renderWithProviders, createMockUserProfile } from '@/lib/test-utils'

// Mock dependencies
jest.mock('next/navigation')
jest.mock('@/contexts/AuthContext')

const mockUseRouter = useRouter as jest.Mock
const mockUseAuth = useAuth as jest.Mock

const mockPush = jest.fn()

describe('AccessControl Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn()
    })
  })

  describe('Loading State', () => {
    it('shows loading spinner during auth check', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        userProfile: null,
        loading: true,
        hasAccess: false,
        isAdmin: false
      })

      render(
        <AccessControl>
          <div>Protected Content</div>
        </AccessControl>
      )

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })
  })

  describe('Unauthenticated User', () => {
    it('redirects to home when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        userProfile: null,
        loading: false,
        hasAccess: false,
        isAdmin: false
      })

      render(
        <AccessControl>
          <div>Protected Content</div>
        </AccessControl>
      )

      expect(mockPush).toHaveBeenCalledWith('/')
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })
  })

  describe('Missing User Profile', () => {
    it('shows profile not found message when user exists but profile is missing', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-1' },
        userProfile: null,
        loading: false,
        hasAccess: false,
        isAdmin: false
      })

      render(
        <AccessControl>
          <div>Protected Content</div>
        </AccessControl>
      )

      expect(screen.getByText('Profile Not Found')).toBeInTheDocument()
      expect(screen.getByText(/Your user profile could not be loaded/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('refreshes page when refresh button is clicked', () => {
      const originalReload = window.location.reload
      window.location.reload = jest.fn()

      mockUseAuth.mockReturnValue({
        user: { id: 'user-1' },
        userProfile: null,
        loading: false,
        hasAccess: false,
        isAdmin: false
      })

      render(
        <AccessControl>
          <div>Protected Content</div>
        </AccessControl>
      )

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      refreshButton.click()

      expect(window.location.reload).toHaveBeenCalled()

      window.location.reload = originalReload
    })
  })

  describe('Pending User', () => {
    it('shows pending approval message for pending users', () => {
      const pendingUser = createMockUserProfile({
        id: 'pending-user',
        role: 'pending'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'pending-user' },
        userProfile: pendingUser,
        loading: false,
        hasAccess: false,
        isAdmin: false
      })

      render(
        <AccessControl>
          <div>Protected Content</div>
        </AccessControl>
      )

      expect(screen.getByText('Account Pending Approval')).toBeInTheDocument()
      expect(screen.getByText(/Your account is pending approval/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /back to login/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /check status/i })).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('navigates to home when back to login is clicked', () => {
      const pendingUser = createMockUserProfile({
        id: 'pending-user',
        role: 'pending'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'pending-user' },
        userProfile: pendingUser,
        loading: false,
        hasAccess: false,
        isAdmin: false
      })

      render(
        <AccessControl>
          <div>Protected Content</div>
        </AccessControl>
      )

      const backButton = screen.getByRole('button', { name: /back to login/i })
      backButton.click()

      expect(mockPush).toHaveBeenCalledWith('/')
    })

    it('refreshes page when check status is clicked', () => {
      const originalReload = window.location.reload
      window.location.reload = jest.fn()

      const pendingUser = createMockUserProfile({
        id: 'pending-user',
        role: 'pending'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'pending-user' },
        userProfile: pendingUser,
        loading: false,
        hasAccess: false,
        isAdmin: false
      })

      render(
        <AccessControl>
          <div>Protected Content</div>
        </AccessControl>
      )

      const checkStatusButton = screen.getByRole('button', { name: /check status/i })
      checkStatusButton.click()

      expect(window.location.reload).toHaveBeenCalled()

      window.location.reload = originalReload
    })

    it('uses custom fallback for pending users when provided', () => {
      const pendingUser = createMockUserProfile({
        id: 'pending-user',
        role: 'pending'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'pending-user' },
        userProfile: pendingUser,
        loading: false,
        hasAccess: false,
        isAdmin: false
      })

      render(
        <AccessControl fallback={<div>Custom Pending Message</div>}>
          <div>Protected Content</div>
        </AccessControl>
      )

      expect(screen.getByText('Custom Pending Message')).toBeInTheDocument()
      expect(screen.queryByText('Account Pending Approval')).not.toBeInTheDocument()
    })
  })

  describe('Admin Role Requirement', () => {
    it('allows admin users to access admin-only content', () => {
      const adminUser = createMockUserProfile({
        id: 'admin-user',
        role: 'admin'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'admin-user' },
        userProfile: adminUser,
        loading: false,
        hasAccess: true,
        isAdmin: true
      })

      render(
        <AccessControl requireRole="admin">
          <div>Admin Only Content</div>
        </AccessControl>
      )

      expect(screen.getByText('Admin Only Content')).toBeInTheDocument()
    })

    it('denies regular users access to admin-only content', () => {
      const regularUser = createMockUserProfile({
        id: 'regular-user',
        role: 'user'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'regular-user' },
        userProfile: regularUser,
        loading: false,
        hasAccess: true,
        isAdmin: false
      })

      render(
        <AccessControl requireRole="admin">
          <div>Admin Only Content</div>
        </AccessControl>
      )

      expect(screen.getByText('Access Denied')).toBeInTheDocument()
      expect(screen.getByText(/Admin privileges are required/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /go to jobs/i })).toBeInTheDocument()
      expect(screen.queryByText('Admin Only Content')).not.toBeInTheDocument()
    })

    it('navigates to jobs when access denied button is clicked', () => {
      const regularUser = createMockUserProfile({
        id: 'regular-user',
        role: 'user'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'regular-user' },
        userProfile: regularUser,
        loading: false,
        hasAccess: true,
        isAdmin: false
      })

      render(
        <AccessControl requireRole="admin">
          <div>Admin Only Content</div>
        </AccessControl>
      )

      const goToJobsButton = screen.getByRole('button', { name: /go to jobs/i })
      goToJobsButton.click()

      expect(mockPush).toHaveBeenCalledWith('/jobs')
    })

    it('uses custom fallback for admin access denied when provided', () => {
      const regularUser = createMockUserProfile({
        id: 'regular-user',
        role: 'user'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'regular-user' },
        userProfile: regularUser,
        loading: false,
        hasAccess: true,
        isAdmin: false
      })

      render(
        <AccessControl requireRole="admin" fallback={<div>Custom Admin Denied</div>}>
          <div>Admin Only Content</div>
        </AccessControl>
      )

      expect(screen.getByText('Custom Admin Denied')).toBeInTheDocument()
      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument()
    })
  })

  describe('User Role Requirement', () => {
    it('allows users with access to view user content', () => {
      const regularUser = createMockUserProfile({
        id: 'regular-user',
        role: 'user'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'regular-user' },
        userProfile: regularUser,
        loading: false,
        hasAccess: true,
        isAdmin: false
      })

      render(
        <AccessControl requireRole="user">
          <div>User Content</div>
        </AccessControl>
      )

      expect(screen.getByText('User Content')).toBeInTheDocument()
    })

    it('denies users without access to user content', () => {
      const pendingUser = createMockUserProfile({
        id: 'pending-user',
        role: 'pending'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'pending-user' },
        userProfile: pendingUser,
        loading: false,
        hasAccess: false,
        isAdmin: false
      })

      render(
        <AccessControl requireRole="user">
          <div>User Content</div>
        </AccessControl>
      )

      expect(screen.getByText('Access Denied')).toBeInTheDocument()
      expect(screen.getByText(/You don't have permission to access this page/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /back to login/i })).toBeInTheDocument()
      expect(screen.queryByText('User Content')).not.toBeInTheDocument()
    })

    it('navigates to home when user access denied button is clicked', () => {
      const pendingUser = createMockUserProfile({
        id: 'pending-user',
        role: 'pending'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'pending-user' },
        userProfile: pendingUser,
        loading: false,
        hasAccess: false,
        isAdmin: false
      })

      render(
        <AccessControl requireRole="user">
          <div>User Content</div>
        </AccessControl>
      )

      const backButton = screen.getByRole('button', { name: /back to login/i })
      backButton.click()

      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  describe('No Role Requirement', () => {
    it('allows any authenticated user with profile to access content', () => {
      const regularUser = createMockUserProfile({
        id: 'regular-user',
        role: 'user'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'regular-user' },
        userProfile: regularUser,
        loading: false,
        hasAccess: true,
        isAdmin: false
      })

      render(
        <AccessControl>
          <div>General Content</div>
        </AccessControl>
      )

      expect(screen.getByText('General Content')).toBeInTheDocument()
    })

    it('allows admin users to access general content', () => {
      const adminUser = createMockUserProfile({
        id: 'admin-user',
        role: 'admin'
      })

      mockUseAuth.mockReturnValue({
        user: { id: 'admin-user' },
        userProfile: adminUser,
        loading: false,
        hasAccess: true,
        isAdmin: true
      })

      render(
        <AccessControl>
          <div>General Content</div>
        </AccessControl>
      )

      expect(screen.getByText('General Content')).toBeInTheDocument()
    })
  })
})

describe('withAuth Higher-Order Component', () => {
  const TestComponent = () => <div>Test Component</div>

  beforeEach(() => {
    jest.clearAllMocks()

    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn()
    })
  })

  it('wraps component with AccessControl', () => {
    const WrappedComponent = withAuth(TestComponent)

    const regularUser = createMockUserProfile({
      id: 'regular-user',
      role: 'user'
    })

    mockUseAuth.mockReturnValue({
      user: { id: 'regular-user' },
      userProfile: regularUser,
      loading: false,
      hasAccess: true,
      isAdmin: false
    })

    render(<WrappedComponent />)

    expect(screen.getByText('Test Component')).toBeInTheDocument()
  })

  it('applies role requirement to wrapped component', () => {
    const WrappedComponent = withAuth(TestComponent, 'admin')

    const regularUser = createMockUserProfile({
      id: 'regular-user',
      role: 'user'
    })

    mockUseAuth.mockReturnValue({
      user: { id: 'regular-user' },
      userProfile: regularUser,
      loading: false,
      hasAccess: true,
      isAdmin: false
    })

    render(<WrappedComponent />)

    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('Test Component')).not.toBeInTheDocument()
  })

  it('sets correct display name for wrapped component', () => {
    const TestComponentWithName = () => <div>Named Component</div>
    TestComponentWithName.displayName = 'TestComponent'

    const WrappedComponent = withAuth(TestComponentWithName)

    expect(WrappedComponent.displayName).toBe('withAuth(TestComponent)')
  })

  it('sets default display name when component has no display name', () => {
    const AnonymousComponent = () => <div>Anonymous Component</div>

    const WrappedComponent = withAuth(AnonymousComponent)

    expect(WrappedComponent.displayName).toBe('withAuth(AnonymousComponent)')
  })

  it('passes props to wrapped component', () => {
    interface TestProps {
      message: string
      count: number
    }

    const PropsTestComponent = ({ message, count }: TestProps) => (
      <div>
        {message} - {count}
      </div>
    )

    const WrappedComponent = withAuth(PropsTestComponent)

    const regularUser = createMockUserProfile({
      id: 'regular-user',
      role: 'user'
    })

    mockUseAuth.mockReturnValue({
      user: { id: 'regular-user' },
      userProfile: regularUser,
      loading: false,
      hasAccess: true,
      isAdmin: false
    })

    render(<WrappedComponent message="Hello" count={42} />)

    expect(screen.getByText('Hello - 42')).toBeInTheDocument()
  })
})

describe('Edge Cases and Error Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn()
    })
  })

  it('handles auth context not being available', () => {
    mockUseAuth.mockImplementation(() => {
      throw new Error('useAuth must be used within an AuthProvider')
    })

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(
        <AccessControl>
          <div>Protected Content</div>
        </AccessControl>
      )
    }).toThrow('useAuth must be used within an AuthProvider')

    consoleSpy.mockRestore()
  })

  it('handles undefined user profile gracefully', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      userProfile: undefined,
      loading: false,
      hasAccess: false,
      isAdmin: false
    })

    render(
      <AccessControl>
        <div>Protected Content</div>
      </AccessControl>
    )

    expect(screen.getByText('Profile Not Found')).toBeInTheDocument()
  })

  it('handles null user gracefully', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      hasAccess: false,
      isAdmin: false
    })

    render(
      <AccessControl>
        <div>Protected Content</div>
      </AccessControl>
    )

    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('handles router not being available', () => {
    mockUseRouter.mockImplementation(() => {
      throw new Error('useRouter must be used within a Next.js app')
    })

    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      hasAccess: false,
      isAdmin: false
    })

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(
        <AccessControl>
          <div>Protected Content</div>
        </AccessControl>
      )
    }).toThrow('useRouter must be used within a Next.js app')

    consoleSpy.mockRestore()
  })
})