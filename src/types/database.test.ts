// Test types and interfaces to ensure type safety in tests
import { User } from '@/types/database'

export interface TestUser extends User {
  // Additional test-specific properties can be added here
}

export interface TestJob {
  id: string
  venue: string
  job_id: string
  status: 'draft' | 'live' | 'processing' | 'complete' | 'error'
  created_by: string
  owner_id: string
  collaborators: string[]
  last_activity: string
  created_at: string
  updated_at: string
  creator?: {
    id: string
    email: string
    full_name: string
    initials: string
    color_index: number
  }
  owner?: {
    id: string
    email: string
    full_name: string
    initials: string
    color_index: number
  }
  collaborator_users?: Array<{
    id: string
    email: string
    full_name: string
    initials: string
    color_index: number
  }>
}

export interface TestActivityLog {
  id: string
  user_id: string
  action: string
  details: Record<string, any>
  status: 'success' | 'failure' | 'pending'
  created_at: string
}

// Test scenario types
export type UserRole = 'pending' | 'user' | 'admin'
export type JobStatus = 'draft' | 'live' | 'processing' | 'complete' | 'error'

export interface TestScenario {
  name: string
  description: string
  setup: () => void
  cleanup?: () => void
}

export interface MockApiResponse<T = any> {
  data: T | null
  error: string | null
  status?: number
}