import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const TEST_API_BASE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Test user credentials
const TEST_USERS = {
  admin: { email: 'admin@test.com', password: 'password123', id: '11111111-1111-1111-1111-111111111111' },
  userA: { email: 'usera@test.com', password: 'password123', id: '22222222-2222-2222-2222-222222222222' },
  userB: { email: 'userb@test.com', password: 'password123', id: '33333333-3333-3333-3333-333333333333' },
  pending: { email: 'pending@test.com', password: 'password123', id: '44444444-4444-4444-4444-444444444444' }
};

// Helper function to get auth headers
async function getAuthHeaders(email: string, password: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error || !data.session) {
    throw new Error(`Failed to authenticate ${email}: ${error?.message}`);
  }
  
  return {
    'Authorization': `Bearer ${data.session.access_token}`,
    'Content-Type': 'application/json'
  };
}

// Helper function to make API requests
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${TEST_API_BASE}/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  return {
    status: response.status,
    data: response.ok ? await response.json() : null,
    error: !response.ok ? await response.text() : null
  };
}

describe('Access Control Tests', () => {
  describe('1. Authentication and Authorization', () => {
    test('1.1 Admin Access: Admin can access admin routes', async () => {
      const headers = await getAuthHeaders(TEST_USERS.admin.email, TEST_USERS.admin.password);
      const response = await apiRequest('/admin/users', { headers });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    test('1.2 Non-Admin Rejection: Regular user cannot access admin routes', async () => {
      const headers = await getAuthHeaders(TEST_USERS.userA.email, TEST_USERS.userA.password);
      const response = await apiRequest('/admin/users', { headers });
      
      expect(response.status).toBe(403);
    });

    test('1.3 Pending User Rejection: Pending user cannot create jobs', async () => {
      const headers = await getAuthHeaders(TEST_USERS.pending.email, TEST_USERS.pending.password);
      const response = await apiRequest('/jobs', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          venue: 'Test Venue',
          job_id: 'TEST-001',
          status: 'draft'
        })
      });
      
      expect(response.status).toBe(403);
    });

    test('1.4 Unauthenticated Rejection: No token should return 401', async () => {
      const response = await apiRequest('/admin/users');
      expect(response.status).toBe(401);
    });

    test('1.5 Admin Self-Demotion Prevention: Admin cannot change own role', async () => {
      const headers = await getAuthHeaders(TEST_USERS.admin.email, TEST_USERS.admin.password);
      const response = await apiRequest(`/admin/users/${TEST_USERS.admin.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ role: 'user' })
      });
      
      expect(response.status).toBe(403);
      expect(response.error).toContain('cannot change their own role');
    });
  });

  describe('2. User Lifecycle Management', () => {
    let newUserId: string;

    test('2.1 User Signup: New users start as pending', async () => {
      // This would typically be handled by Supabase Auth trigger
      // For testing, we'll verify the user creation flow through the API
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // Sign up a new user
      const { data, error } = await supabase.auth.signUp({
        email: 'newuser@test.com',
        password: 'password123'
      });
      
      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      
      if (data.user) {
        newUserId = data.user.id;
        
        // Check user record was created with pending status
        // Note: In real scenario, this would be done by the trigger
        const { data: userData } = await supabase
          .from('users')
          .select('role, approved_at')
          .eq('id', newUserId)
          .single();
          
        expect(userData?.role).toBe('pending');
        expect(userData?.approved_at).toBeNull();
      }
    });

    test('2.2 User Approval: Admin can approve pending users', async () => {
      if (!newUserId) {
        // Create a test pending user for this test
        newUserId = '55555555-5555-5555-5555-555555555555';
      }
      
      const headers = await getAuthHeaders(TEST_USERS.admin.email, TEST_USERS.admin.password);
      const response = await apiRequest(`/admin/users/${TEST_USERS.pending.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ role: 'user' })
      });
      
      expect(response.status).toBe(200);
      expect(response.data.data.role).toBe('user');
      expect(response.data.data.approved_at).toBeDefined();
      expect(response.data.data.approved_by).toBe(TEST_USERS.admin.id);
    });

    test('2.3 Post-Approval Functionality: Newly approved user can create jobs', async () => {
      const headers = await getAuthHeaders(TEST_USERS.pending.email, TEST_USERS.pending.password);
      const response = await apiRequest('/jobs', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          venue: 'Approved User Venue',
          job_id: 'APPROVED-001',
          status: 'draft'
        })
      });
      
      expect(response.status).toBe(201);
      expect(response.data.data.venue).toBe('Approved User Venue');
    });

    test('2.4 Admin Promotion: Admin can promote user to admin', async () => {
      const headers = await getAuthHeaders(TEST_USERS.admin.email, TEST_USERS.admin.password);
      const response = await apiRequest(`/admin/users/${TEST_USERS.userA.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ role: 'admin' })
      });
      
      expect(response.status).toBe(200);
      expect(response.data.data.role).toBe('admin');
    });

    test('2.5 New Admin Verification: Newly promoted admin can access admin routes', async () => {
      const headers = await getAuthHeaders(TEST_USERS.userA.email, TEST_USERS.userA.password);
      const response = await apiRequest('/admin/logs', { headers });
      
      expect(response.status).toBe(200);
    });
  });

  describe('3. Job Ownership and Transfer', () => {
    const testJobId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    test('3.1 Job Creation: User creates job and becomes owner', async () => {
      const headers = await getAuthHeaders(TEST_USERS.userB.email, TEST_USERS.userB.password);
      const response = await apiRequest('/jobs', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          venue: 'Ownership Test Venue',
          job_id: 'OWNER-001',
          status: 'draft'
        })
      });
      
      expect(response.status).toBe(201);
      expect(response.data.data.created_by).toBe(TEST_USERS.userB.id);
      expect(response.data.data.owner_id).toBe(TEST_USERS.userB.id);
    });

    test('3.2 Ownership Transfer Success: Owner transfers to another user', async () => {
      const headers = await getAuthHeaders(TEST_USERS.userA.email, TEST_USERS.userA.password);
      const response = await apiRequest(`/jobs/${testJobId}/owner`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ newOwnerId: TEST_USERS.userB.id })
      });
      
      expect(response.status).toBe(200);
      expect(response.data.data.owner_id).toBe(TEST_USERS.userB.id);
      expect(response.data.data.created_by).toBe(TEST_USERS.userA.id); // Unchanged
    });

    test('3.3 Former Owner Access Denied: Former owner cannot delete job', async () => {
      const headers = await getAuthHeaders(TEST_USERS.userA.email, TEST_USERS.userA.password);
      const response = await apiRequest(`/jobs/${testJobId}`, {
        method: 'DELETE',
        headers
      });
      
      expect(response.status).toBe(403);
    });

    test('3.4 Admin Ownership Override: Admin can transfer any job', async () => {
      const headers = await getAuthHeaders(TEST_USERS.admin.email, TEST_USERS.admin.password);
      const response = await apiRequest(`/jobs/${testJobId}/owner`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ newOwnerId: TEST_USERS.userA.id })
      });
      
      expect(response.status).toBe(200);
      expect(response.data.data.owner_id).toBe(TEST_USERS.userA.id);
    });
  });
});

describe('4. Real-time Updates', () => {
  test('4.1 Connection Status: Real-time connection can be established', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Sign in as test user
    await supabase.auth.signInWithPassword({
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password
    });
    
    // Set up channel subscription
    const channel = supabase
      .channel('test-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, 
         (payload) => console.log('Received:', payload))
      .subscribe();
      
    // Wait for subscription
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    expect(channel.state).toBe('joined');
    
    // Clean up
    supabase.removeChannel(channel);
  });
});

describe('5. Edge Cases and Security', () => {
  test('5.1 Invalid Job ID: Returns 404 for non-existent job', async () => {
    const headers = await getAuthHeaders(TEST_USERS.admin.email, TEST_USERS.admin.password);
    const response = await apiRequest('/jobs/00000000-0000-0000-0000-000000000000', { headers });
    
    expect(response.status).toBe(404);
  });

  test('5.2 Invalid User ID: Returns error for non-existent user', async () => {
    const headers = await getAuthHeaders(TEST_USERS.admin.email, TEST_USERS.admin.password);
    const response = await apiRequest('/admin/users/00000000-0000-0000-0000-000000000000', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ role: 'user' })
    });
    
    expect(response.status).toBe(400);
  });

  test('5.3 Malformed Request: Returns 400 for invalid JSON', async () => {
    const headers = await getAuthHeaders(TEST_USERS.admin.email, TEST_USERS.admin.password);
    const response = await fetch(`${TEST_API_BASE}/api/jobs`, {
      method: 'POST',
      headers,
      body: 'invalid json'
    });
    
    expect(response.status).toBe(400);
  });

  test('5.4 SQL Injection Protection: RLS policies protect against injection', async () => {
    const headers = await getAuthHeaders(TEST_USERS.userA.email, TEST_USERS.userA.password);
    const response = await apiRequest('/jobs', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        venue: "'; DROP TABLE jobs; --",
        job_id: 'INJECTION-TEST',
        status: 'draft'
      })
    });
    
    // Should either succeed (data sanitized) or fail gracefully
    expect([201, 400, 500]).toContain(response.status);
    
    // Verify table still exists by making another request
    const verifyResponse = await apiRequest('/jobs', { headers });
    expect(verifyResponse.status).toBe(200);
  });
});