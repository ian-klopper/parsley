import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AuthProvider } from '@/contexts/AuthContext'
import { User } from '@supabase/supabase-js'
import { User as UserProfile } from '@/types/database'

// Mock data factories
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-123',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  aud: 'authenticated',
  role: 'authenticated',
  email_confirmed_at: '2024-01-01T00:00:00Z',
  phone: '',
  last_sign_in_at: '2024-01-01T00:00:00Z',
  app_metadata: {},
  user_metadata: {},
  identities: [],
  ...overrides
})

export const createMockUserProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'user-123',
  email: 'test@example.com',
  full_name: 'Test User',
  initials: 'TU',
  role: 'user',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  color_index: 0,
  ...overrides
})

export const createMockJob = (overrides: any = {}) => ({
  id: 'job-123',
  venue: 'Test Venue',
  job_id: 'TEST-001',
  status: 'draft',
  created_by: 'user-123',
  owner_id: 'user-123',
  collaborators: [],
  last_activity: '2024-01-01T00:00:00Z',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  creator: {
    id: 'user-123',
    email: 'test@example.com',
    full_name: 'Test User',
    initials: 'TU',
    color_index: 0
  },
  collaborator_users: [],
  ...overrides
})

// Mock providers for testing
interface TestProviderProps {
  children: React.ReactNode
  mockUser?: User | null
  mockUserProfile?: UserProfile | null
  loading?: boolean
  hasAccess?: boolean
  isAdmin?: boolean
}

export const TestProvider: React.FC<TestProviderProps> = ({
  children,
  mockUser = createMockUser(),
  mockUserProfile = createMockUserProfile(),
  loading = false,
  hasAccess = true,
  isAdmin = false
}) => {
  // Mock the useAuth hook values
  const mockAuthValue = {
    user: mockUser,
    userProfile: mockUserProfile,
    loading,
    hasAccess,
    isAdmin,
    signOut: jest.fn(),
    refreshProfile: jest.fn()
  }

  // Mock the AuthContext
  const MockAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // This would normally use AuthContext, but for testing we'll mock it
    const AuthContext = React.createContext(mockAuthValue)
    return <AuthContext.Provider value={mockAuthValue}>{children}</AuthContext.Provider>
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <MockAuthProvider>
        {children}
      </MockAuthProvider>
    </ThemeProvider>
  )
}

// Custom render function
interface CustomRenderOptions extends RenderOptions {
  mockUser?: User | null
  mockUserProfile?: UserProfile | null
  loading?: boolean
  hasAccess?: boolean
  isAdmin?: boolean
}

export const renderWithProviders = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const {
    mockUser,
    mockUserProfile,
    loading,
    hasAccess,
    isAdmin,
    ...renderOptions
  } = options

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <TestProvider
      mockUser={mockUser}
      mockUserProfile={mockUserProfile}
      loading={loading}
      hasAccess={hasAccess}
      isAdmin={isAdmin}
    >
      {children}
    </TestProvider>
  )

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Test data sets
export const testUsers: UserProfile[] = [
  createMockUserProfile({
    id: 'admin-1',
    email: 'admin@test.com',
    full_name: 'Admin User',
    role: 'admin',
    initials: 'AU'
  }),
  createMockUserProfile({
    id: 'user-1',
    email: 'user1@test.com',
    full_name: 'Regular User 1',
    role: 'user',
    initials: 'RU'
  }),
  createMockUserProfile({
    id: 'user-2',
    email: 'user2@test.com',
    full_name: 'Regular User 2',
    role: 'user',
    initials: 'R2'
  }),
  createMockUserProfile({
    id: 'pending-1',
    email: 'pending@test.com',
    full_name: 'Pending User',
    role: 'pending',
    initials: 'PU'
  })
]

export const testJobs = [
  createMockJob({
    id: 'job-1',
    venue: 'Restaurant A',
    job_id: 'REST-A-001',
    status: 'draft',
    collaborators: ['user-1'],
    collaborator_users: [testUsers[1]]
  }),
  createMockJob({
    id: 'job-2',
    venue: 'Bar B',
    job_id: 'BAR-B-002',
    status: 'live',
    collaborators: ['user-1', 'user-2'],
    collaborator_users: [testUsers[1], testUsers[2]]
  }),
  createMockJob({
    id: 'job-3',
    venue: 'Cafe C',
    job_id: 'CAFE-C-003',
    status: 'complete',
    collaborators: [],
    collaborator_users: []
  })
]

// Mock implementations
export const mockApiResponses = {
  users: {
    success: { data: testUsers, error: null },
    error: { data: null, error: 'Failed to fetch users' },
    empty: { data: [], error: null }
  },
  jobs: {
    success: { jobs: testJobs, error: null },
    error: { jobs: null, error: 'Failed to fetch jobs' },
    empty: { jobs: [], error: null }
  }
}

// Utility functions for testing
export const waitForLoadingToFinish = () => {
  return new Promise(resolve => setTimeout(resolve, 0))
}

export const mockConsoleError = () => {
  const originalError = console.error
  console.error = jest.fn()
  return () => { console.error = originalError }
}

export const mockConsoleLog = () => {
  const originalLog = console.log
  console.log = jest.fn()
  return () => { console.log = originalLog }
}

// Mock Supabase client for testing
export const createMockSupabaseClient = (responses: any = {}) => ({
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      order: jest.fn(() => ({
        data: responses.data || [],
        error: responses.error || null
      })),
      eq: jest.fn(() => ({
        single: jest.fn(() => ({
          data: responses.data || null,
          error: responses.error || null
        })),
        data: responses.data || [],
        error: responses.error || null
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => ({
          data: responses.data || null,
          error: responses.error || null
        }))
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: responses.data || null,
            error: responses.error || null
          }))
        }))
      }))
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() => ({
        data: responses.data || null,
        error: responses.error || null
      }))
    }))
  })),
  auth: {
    getSession: jest.fn(() =>
      Promise.resolve({
        data: {
          session: responses.session || {
            access_token: 'mock-token',
            user: createMockUser()
          }
        },
        error: null
      })
    ),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } }
    })),
    signOut: jest.fn(() => Promise.resolve({ error: null }))
  }
})