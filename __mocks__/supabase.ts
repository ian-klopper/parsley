import { createMockSupabaseClient } from '@/lib/test-utils'

// Mock Supabase client with configurable responses
let mockResponses: any = {}

export const setMockResponses = (responses: any) => {
  mockResponses = responses
}

export const resetMockResponses = () => {
  mockResponses = {}
}

// Create the mock client
const mockSupabase = createMockSupabaseClient(mockResponses)

// Mock the supabase module
export const supabase = mockSupabase

// Export the mock functions for use in tests
export { createMockSupabaseClient }