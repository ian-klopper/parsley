#!/usr/bin/env node

/**
 * Comprehensive System Test Suite
 * Tests the complete auth, user, jobs, and collaborator system
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test state
const testData = {
  users: {
    admin: { id: null, email: `test-admin-${uuidv4()}@example.com`, password: 'testpass123', role: 'admin', session: null },
    user1: { id: null, email: `test-user1-${uuidv4()}@example.com`, password: 'testpass123', role: 'user', session: null },
    user2: { id: null, email: `test-user2-${uuidv4()}@example.com`, password: 'testpass123', role: 'user', session: null },
    pending: { id: null, email: `test-pending-${uuidv4()}@example.com`, password: 'testpass123', role: 'pending', session: null }
  },
  jobs: {},
  cleanupTasks: []
};

// Utility functions
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`❌ Assertion failed: ${message}`);
  }
  console.log(`✅ ${message}`);
};

const runTest = async (name, testFn) => {
  try {
    console.log(`\n🧪 Running test: ${name}`);
    await testFn();
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    console.error(`❌ FAILED: ${name}`);
    console.error(error.message);
    throw error; // Re-throw to stop execution
  }
};

const cleanup = async () => {
  console.log('\n🧹 Cleaning up test data...');

  try {
    // Clean up jobs
    for (const job of Object.values(testData.jobs)) {
      if (job.id) {
        await supabaseAdmin.from('jobs').delete().eq('id', job.id);
        console.log(`- Deleted job ${job.id}`);
      }
    }

    // Clean up users (auth and profiles)
    for (const user of Object.values(testData.users)) {
      if (user.id) {
        // Delete auth user
        await supabaseAdmin.auth.admin.deleteUser(user.id);
        // Delete profile (if exists)
        await supabaseAdmin.from('users').delete().eq('id', user.id);
        console.log(`- Deleted user ${user.email}`);
      }
    }

    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  }
};

// Helper to make authenticated API requests
const makeApiRequest = async (method, endpoint, data = null, userKey = null) => {
  const config = {
    method,
    url: `${BASE_URL}/api${endpoint}`,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (userKey && testData.users[userKey]?.session) {
    config.headers['Authorization'] = `Bearer ${testData.users[userKey].session.access_token}`;
  }

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return { data: response.data, status: response.status };
  } catch (error) {
    if (error.response) {
      return { data: error.response.data, status: error.response.status };
    }
    throw error;
  }
};

// Test functions
const testUserCreation = async () => {
  console.log('Creating test users...');

  for (const [key, userData] of Object.entries(testData.users)) {
    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true
    });

    assert(!authError, `Created auth user for ${userData.email}`);
    userData.id = authData.user.id;

    // Create user profile
    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: userData.id,
      email: userData.email,
      full_name: `Test ${key.charAt(0).toUpperCase() + key.slice(1)} User`,
      role: userData.role
    });

    assert(!profileError, `Created profile for ${userData.email}`);
  }
};

const testUserAuthentication = async () => {
  for (const [key, userData] of Object.entries(testData.users)) {
    const userClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data, error } = await userClient.auth.signInWithPassword({
      email: userData.email,
      password: userData.password
    });

    assert(!error && data.session, `User ${key} can authenticate`);
    userData.session = data.session;
  }
};

const testJobCreation = async () => {
  // Test non-pending users can create jobs
  const jobData = {
    venue: 'Test Venue 1',
    job_id: `test-job-${Date.now()}`,
    status: 'draft'
  };

  const response = await makeApiRequest('POST', '/jobs', jobData, 'user1');
  assert(response.status === 201, 'Non-pending user can create job');
  assert(response.data.data.created_by === testData.users.user1.id, 'Job has correct creator');

  testData.jobs.job1 = response.data.data;
};

const testJobAccess = async () => {
  // Test user can see their own jobs
  const response = await makeApiRequest('GET', '/jobs', null, 'user1');
  assert(response.status === 200, 'User can fetch jobs');
  assert(response.data.data.length >= 1, 'User can see their own job');

  const userJob = response.data.data.find(job => job.id === testData.jobs.job1.id);
  assert(userJob, 'User can see their created job in list');
};

const testPendingUserRestrictions = async () => {
  // Test pending user cannot create jobs
  const jobData = {
    venue: 'Pending User Venue',
    job_id: `pending-job-${Date.now()}`,
    status: 'draft'
  };

  const response = await makeApiRequest('POST', '/jobs', jobData, 'pending');
  assert(response.status === 403, 'Pending user cannot create jobs');
};

const testCollaboratorManagement = async () => {
  const jobId = testData.jobs.job1.id;

  // Test adding collaborator
  const addResponse = await makeApiRequest(
    'POST',
    `/jobs/${jobId}/collaborators`,
    { email: testData.users.user2.email },
    'user1'
  );

  assert(addResponse.status === 200, 'Job owner can add collaborator');
  assert(addResponse.data.data.added_collaborator.email === testData.users.user2.email, 'Correct collaborator added');

  // Test collaborator can see the job
  const jobsResponse = await makeApiRequest('GET', '/jobs', null, 'user2');
  assert(jobsResponse.status === 200, 'Collaborator can fetch jobs');

  const collaboratorJob = jobsResponse.data.data.find(job => job.id === jobId);
  assert(collaboratorJob, 'Collaborator can see job they were added to');

  // Test removing collaborator
  const removeResponse = await makeApiRequest(
    'DELETE',
    `/jobs/${jobId}/collaborators?collaborator_id=${testData.users.user2.id}`,
    null,
    'user1'
  );

  assert(removeResponse.status === 200, 'Job owner can remove collaborator');
};

const testAdminAccess = async () => {
  // Test admin can see all jobs
  const response = await makeApiRequest('GET', '/jobs', null, 'admin');
  assert(response.status === 200, 'Admin can fetch jobs');

  const adminJob = response.data.data.find(job => job.id === testData.jobs.job1.id);
  assert(adminJob, 'Admin can see all jobs');
};

const testRoleManagement = async () => {
  // Test admin can update user role
  const response = await makeApiRequest(
    'PUT',
    `/admin/users/${testData.users.pending.id}`,
    { role: 'user' },
    'admin'
  );

  assert(response.status === 200, 'Admin can update user role');

  // Verify role was updated
  const { data: updatedUser } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', testData.users.pending.id)
    .single();

  assert(updatedUser.role === 'user', 'User role was updated correctly');
};

const testJobCRUD = async () => {
  const jobId = testData.jobs.job1.id;

  // Test job update
  const updateResponse = await makeApiRequest(
    'PUT',
    `/jobs/${jobId}`,
    { venue: 'Updated Test Venue' },
    'user1'
  );

  assert(updateResponse.status === 200, 'Job owner can update job');
  assert(updateResponse.data.data.venue === 'Updated Test Venue', 'Job was updated correctly');

  // Test job deletion
  const deleteResponse = await makeApiRequest('DELETE', `/jobs/${jobId}`, null, 'user1');
  assert(deleteResponse.status === 200, 'Job owner can delete job');

  // Verify job is deleted
  const getResponse = await makeApiRequest('GET', `/jobs/${jobId}`, null, 'user1');
  assert(getResponse.status === 404, 'Deleted job returns 404');
};

// Main test runner
const runAllTests = async () => {
  console.log('🚀 Starting Comprehensive System Test Suite\n');

  try {
    await runTest('User Creation', testUserCreation);
    await runTest('User Authentication', testUserAuthentication);
    await runTest('Job Creation', testJobCreation);
    await runTest('Job Access Control', testJobAccess);
    await runTest('Pending User Restrictions', testPendingUserRestrictions);
    await runTest('Collaborator Management', testCollaboratorManagement);
    await runTest('Admin Access', testAdminAccess);
    await runTest('Role Management', testRoleManagement);
    await runTest('Job CRUD Operations', testJobCRUD);

    console.log('\n🎉 ALL TESTS PASSED! The system is fully functional.');

  } catch (error) {
    console.error('\n💥 TEST SUITE FAILED!');
    console.error(error.message);
    process.exit(1);
  } finally {
    await cleanup();
  }
};

// Handle cleanup on exit
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// Run the tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  cleanup();
  process.exit(1);
});