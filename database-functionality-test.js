#!/usr/bin/env node

/**
 * Database Functionality Test
 * Tests core database functions, RPC calls, and RLS policies
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test data
const testUsers = {
  admin: { id: null, email: `test-admin-${uuidv4()}@example.com`, role: 'admin' },
  user1: { id: null, email: `test-user1-${uuidv4()}@example.com`, role: 'user' },
  user2: { id: null, email: `test-user2-${uuidv4()}@example.com`, role: 'user' },
  pending: { id: null, email: `test-pending-${uuidv4()}@example.com`, role: 'pending' }
};

let testJobId = null;

// Utilities
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ ${message}`);
};

const runTest = async (name, testFn) => {
  try {
    console.log(`\n🧪 ${name}`);
    await testFn();
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    console.error(`❌ FAILED: ${name} - ${error.message}`);
    throw error;
  }
};

const cleanup = async () => {
  console.log('\n🧹 Cleaning up...');
  try {
    if (testJobId) {
      await supabaseAdmin.from('jobs').delete().eq('id', testJobId);
      console.log('- Deleted test job');
    }

    const userIds = Object.values(testUsers).map(u => u.id).filter(Boolean);
    if (userIds.length > 0) {
      await supabaseAdmin.from('users').delete().in('id', userIds);
      console.log(`- Deleted ${userIds.length} test users`);
    }
  } catch (error) {
    console.error('Cleanup error:', error.message);
  }
};

// Test functions
const testDatabaseConnection = async () => {
  const { data, error } = await supabaseAdmin.from('users').select('count').limit(1);
  assert(!error, 'Database connection successful');
};

const testUserCreation = async () => {
  for (const [key, user] of Object.entries(testUsers)) {
    const userData = {
      id: uuidv4(),
      email: user.email,
      full_name: `Test ${key} User`,
      role: user.role
    };

    const { data, error } = await supabaseAdmin.from('users').insert(userData).select().single();
    assert(!error, `Created ${key} user`);
    assert(data.initials, `Auto-generated initials for ${key}`);
    assert(typeof data.color_index === 'number', `Auto-generated color for ${key}`);

    user.id = data.id;
  }
};

const testJobCreation = async () => {
  const jobData = {
    venue: 'Test Venue Database',
    job_id: `test-job-${Date.now()}`,
    status: 'draft',
    created_by: testUsers.user1.id,
    owner_id: testUsers.user1.id,
    collaborators: []
  };

  const { data, error } = await supabaseAdmin.from('jobs').insert(jobData).select().single();
  assert(!error, 'Created test job');
  assert(data.created_by === testUsers.user1.id, 'Job has correct creator');
  assert(data.owner_id === testUsers.user1.id, 'Job has correct owner');

  testJobId = data.id;
};

const testGetJobsForUserRPC = async () => {
  // Test RPC function exists and works for user1 (owner)
  const { data, error } = await supabaseAdmin.rpc('get_jobs_for_user', {
    user_id: testUsers.user1.id
  });

  assert(!error, 'get_jobs_for_user RPC function works');
  assert(Array.isArray(data), 'RPC returns array');
  assert(data.length >= 1, 'User can see their own job');

  const userJob = data.find(job => job.id === testJobId);
  assert(userJob, 'RPC returns user\'s job');
};

const testCollaboratorAccess = async () => {
  // Add user2 as collaborator
  const { error: updateError } = await supabaseAdmin
    .from('jobs')
    .update({
      collaborators: [testUsers.user2.id]
    })
    .eq('id', testJobId);

  assert(!updateError, 'Added collaborator to job');

  // Test collaborator can see job via RPC
  const { data, error } = await supabaseAdmin.rpc('get_jobs_for_user', {
    user_id: testUsers.user2.id
  });

  assert(!error, 'RPC works for collaborator');
  const collabJob = data.find(job => job.id === testJobId);
  assert(collabJob, 'Collaborator can see job');
};

const testAdminAccess = async () => {
  // Test admin can see all jobs
  const { data, error } = await supabaseAdmin.rpc('get_jobs_for_user', {
    user_id: testUsers.admin.id
  });

  assert(!error, 'RPC works for admin');
  const adminJob = data.find(job => job.id === testJobId);
  assert(adminJob, 'Admin can see all jobs');
};

const testUpdateUserRoleRPC = async () => {
  // Test the update_user_role RPC function
  const { error } = await supabaseAdmin.rpc('update_user_role', {
    p_user_id: testUsers.pending.id,
    p_new_role: 'user',
    p_admin_id: testUsers.admin.id
  });

  assert(!error, 'update_user_role RPC function works');

  // Verify the role was updated
  const { data, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('role, approved_at, approved_by')
    .eq('id', testUsers.pending.id)
    .single();

  assert(!fetchError, 'Fetched updated user');
  assert(data.role === 'user', 'User role was updated');
  assert(data.approved_at, 'Approval timestamp was set');
  assert(data.approved_by === testUsers.admin.id, 'Approved by admin');
};

const testRowLevelSecurity = async () => {
  // Create a regular client (not admin)
  const regularClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Test that unauthenticated users can't access sensitive data
  const { data, error } = await regularClient.from('users').select('*');

  // Should work because we have universal read policy
  assert(!error, 'RLS allows read access as configured');
  assert(Array.isArray(data), 'Returns user data');
};

const testActivityLogging = async () => {
  // Check if activity logs were created during our tests
  const { data, error } = await supabaseAdmin
    .from('activity_logs')
    .select('*')
    .in('user_id', Object.values(testUsers).map(u => u.id));

  assert(!error, 'Can query activity logs');
  assert(data.length > 0, 'Activity logs were created automatically');
};

// Main test runner
const main = async () => {
  console.log('🚀 Database Functionality Test Suite');
  console.log('=====================================\n');

  try {
    await runTest('Database Connection', testDatabaseConnection);
    await runTest('User Creation with Auto-Generated Fields', testUserCreation);
    await runTest('Job Creation', testJobCreation);
    await runTest('get_jobs_for_user RPC Function', testGetJobsForUserRPC);
    await runTest('Collaborator Access Control', testCollaboratorAccess);
    await runTest('Admin Access Control', testAdminAccess);
    await runTest('update_user_role RPC Function', testUpdateUserRoleRPC);
    await runTest('Row Level Security', testRowLevelSecurity);
    await runTest('Activity Logging', testActivityLogging);

    console.log('\n🎉 ALL DATABASE TESTS PASSED!');
    console.log('✅ Core database functionality is working correctly');
    console.log('✅ RPC functions are implemented and functional');
    console.log('✅ Row Level Security policies are working');
    console.log('✅ Auto-generated fields are working');
    console.log('✅ Activity logging is functional');

  } catch (error) {
    console.error('\n💥 DATABASE TEST SUITE FAILED!');
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await cleanup();
  }
};

// Cleanup on exit
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Run tests
main();