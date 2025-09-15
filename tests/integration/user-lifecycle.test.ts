import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const TEST_API_BASE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

describe('User Lifecycle Integration Tests', () => {
  let supabaseAdmin: any;
  let testUserEmail: string;
  let testUserId: string;
  let adminHeaders: any;

  beforeAll(async () => {
    // Set up admin client
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await supabaseAdmin.auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'password123'
    });
    
    adminHeaders = {
      'Authorization': `Bearer ${(await supabaseAdmin.auth.getSession()).data.session?.access_token}`,
      'Content-Type': 'application/json'
    };
    
    testUserEmail = `test-${Date.now()}@example.com`;
  });

  afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      await fetch(`${TEST_API_BASE}/api/admin/users/${testUserId}`, {
        method: 'DELETE',
        headers: adminHeaders
      });
    }
  });

  test('Complete User Journey: Pending → User → Admin', async () => {
    // Step 1: User signup
    const signupResult = await supabaseAdmin.auth.signUp({
      email: testUserEmail,
      password: 'testpassword123'
    });
    
    expect(signupResult.error).toBeNull();
    expect(signupResult.data.user).toBeDefined();
    testUserId = signupResult.data.user!.id;

    // Step 2: Verify user starts as pending
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for trigger
    
    const { data: pendingUser } = await supabaseAdmin
      .from('users')
      .select('role, approved_at, approved_by')
      .eq('id', testUserId)
      .single();
    
    expect(pendingUser?.role).toBe('pending');
    expect(pendingUser?.approved_at).toBeNull();
    expect(pendingUser?.approved_by).toBeNull();

    // Step 3: Verify pending user cannot create jobs
    const userAuth = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await userAuth.auth.signInWithPassword({
      email: testUserEmail,
      password: 'testpassword123'
    });
    
    const userHeaders = {
      'Authorization': `Bearer ${(await userAuth.auth.getSession()).data.session?.access_token}`,
      'Content-Type': 'application/json'
    };

    const jobCreateResponse = await fetch(`${TEST_API_BASE}/api/jobs`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({
        venue: 'Test Venue',
        job_id: 'TEST-PENDING',
        status: 'draft'
      })
    });
    
    expect(jobCreateResponse.status).toBe(403);

    // Step 4: Admin approves user
    const approvalResponse = await fetch(`${TEST_API_BASE}/api/admin/users/${testUserId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ role: 'user' })
    });
    
    expect(approvalResponse.status).toBe(200);
    const approvedUser = await approvalResponse.json();
    expect(approvedUser.data.role).toBe('user');
    expect(approvedUser.data.approved_at).toBeDefined();
    expect(approvedUser.data.approved_by).toBe('11111111-1111-1111-1111-111111111111');

    // Step 5: Verify activity log entry
    const logsResponse = await fetch(`${TEST_API_BASE}/api/admin/logs?limit=10`, {
      headers: adminHeaders
    });
    
    const logs = await logsResponse.json();
    const approvalLog = logs.data.find((log: any) => 
      log.user_id === testUserId && log.action === 'USER_APPROVED'
    );
    
    expect(approvalLog).toBeDefined();
    expect(approvalLog.details.old_role).toBe('pending');
    expect(approvalLog.details.new_role).toBe('user');

    // Step 6: Approved user can now create jobs
    const jobCreateResponse2 = await fetch(`${TEST_API_BASE}/api/jobs`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({
        venue: 'Approved User Venue',
        job_id: 'TEST-APPROVED',
        status: 'draft'
      })
    });
    
    expect(jobCreateResponse2.status).toBe(201);
    const createdJob = await jobCreateResponse2.json();
    expect(createdJob.data.created_by).toBe(testUserId);
    expect(createdJob.data.owner_id).toBe(testUserId);

    // Step 7: Admin promotes user to admin
    const promotionResponse = await fetch(`${TEST_API_BASE}/api/admin/users/${testUserId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ role: 'admin' })
    });
    
    expect(promotionResponse.status).toBe(200);
    const promotedUser = await promotionResponse.json();
    expect(promotedUser.data.role).toBe('admin');

    // Step 8: New admin can access admin routes
    const newAdminHeaders = {
      'Authorization': `Bearer ${(await userAuth.auth.getSession()).data.session?.access_token}`,
      'Content-Type': 'application/json'
    };

    const adminAccessResponse = await fetch(`${TEST_API_BASE}/api/admin/users`, {
      headers: newAdminHeaders
    });
    
    expect(adminAccessResponse.status).toBe(200);

    // Step 9: New admin can view logs
    const newAdminLogsResponse = await fetch(`${TEST_API_BASE}/api/admin/logs`, {
      headers: newAdminHeaders
    });
    
    expect(newAdminLogsResponse.status).toBe(200);
  });

  test('Ownership Transfer Workflow', async () => {
    // Create two test users for this workflow
    const userAEmail = `usera-${Date.now()}@example.com`;
    const userBEmail = `userb-${Date.now()}@example.com`;
    
    // Sign up users
    const userASignup = await supabaseAdmin.auth.signUp({
      email: userAEmail,
      password: 'password123'
    });
    
    const userBSignup = await supabaseAdmin.auth.signUp({
      email: userBEmail,
      password: 'password123'
    });
    
    const userAId = userASignup.data.user!.id;
    const userBId = userBSignup.data.user!.id;
    
    // Approve both users
    await fetch(`${TEST_API_BASE}/api/admin/users/${userAId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ role: 'user' })
    });
    
    await fetch(`${TEST_API_BASE}/api/admin/users/${userBId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ role: 'user' })
    });

    // User A creates a job
    const userAClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await userAClient.auth.signInWithPassword({
      email: userAEmail,
      password: 'password123'
    });
    
    const userAHeaders = {
      'Authorization': `Bearer ${(await userAClient.auth.getSession()).data.session?.access_token}`,
      'Content-Type': 'application/json'
    };

    const jobResponse = await fetch(`${TEST_API_BASE}/api/jobs`, {
      method: 'POST',
      headers: userAHeaders,
      body: JSON.stringify({
        venue: 'Transfer Test Venue',
        job_id: 'TRANSFER-001',
        status: 'draft'
      })
    });
    
    const job = await jobResponse.json();
    const jobId = job.data.id;
    
    expect(job.data.created_by).toBe(userAId);
    expect(job.data.owner_id).toBe(userAId);

    // User A transfers ownership to User B
    const transferResponse = await fetch(`${TEST_API_BASE}/api/jobs/${jobId}/owner`, {
      method: 'PUT',
      headers: userAHeaders,
      body: JSON.stringify({ newOwnerId: userBId })
    });
    
    expect(transferResponse.status).toBe(200);
    const transferredJob = await transferResponse.json();
    expect(transferredJob.data.owner_id).toBe(userBId);
    expect(transferredJob.data.created_by).toBe(userAId); // Should remain unchanged

    // User A (former owner) cannot delete the job
    const deleteResponse = await fetch(`${TEST_API_BASE}/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: userAHeaders
    });
    
    expect(deleteResponse.status).toBe(403);

    // User B (new owner) can delete the job
    const userBClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await userBClient.auth.signInWithPassword({
      email: userBEmail,
      password: 'password123'
    });
    
    const userBHeaders = {
      'Authorization': `Bearer ${(await userBClient.auth.getSession()).data.session?.access_token}`,
      'Content-Type': 'application/json'
    };

    const deleteResponse2 = await fetch(`${TEST_API_BASE}/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: userBHeaders
    });
    
    expect(deleteResponse2.status).toBe(200);

    // Verify transfer was logged
    const logsResponse = await fetch(`${TEST_API_BASE}/api/admin/logs?limit=20`, {
      headers: adminHeaders
    });
    
    const logs = await logsResponse.json();
    const transferLog = logs.data.find((log: any) => 
      log.action === 'JOB_OWNERSHIP_TRANSFERRED' && 
      log.details.job_id === jobId
    );
    
    expect(transferLog).toBeDefined();
    expect(transferLog.details.old_owner).toBe(userAId);
    expect(transferLog.details.new_owner).toBe(userBId);
    expect(transferLog.details.transferred_by).toBe(userAId);

    // Clean up test users
    await fetch(`${TEST_API_BASE}/api/admin/users/${userAId}`, {
      method: 'DELETE',
      headers: adminHeaders
    });
    
    await fetch(`${TEST_API_BASE}/api/admin/users/${userBId}`, {
      method: 'DELETE',
      headers: adminHeaders
    });
  });
});