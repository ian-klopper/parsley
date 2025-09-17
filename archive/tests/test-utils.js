const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Test user data - using valid email domains for Supabase
const testUsers = {
  admin: {
    email: 'admin@example.com',
    password: 'AdminTest123!',
    role: 'admin',
    status: 'active'
  },
  regularUser1: {
    email: 'user1@example.com',
    password: 'UserTest123!',
    role: 'user',
    status: 'active'
  },
  regularUser2: {
    email: 'user2@example.com',
    password: 'UserTest123!',
    role: 'user',
    status: 'active'
  },
  pendingUser: {
    email: 'pending@example.com',
    password: 'PendingTest123!',
    role: 'user',
    status: 'pending'
  }
};

// Utility functions
async function clearDatabase() {
  console.log('🧹 Clearing database...');

  // Clear in correct order to respect foreign key constraints
  // Using correct table names from the database
  const tables = [
    'activity_logs',
    'jobs',
    'users'
  ];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error && error.code !== 'PGRST116') { // Ignore "no rows" error
      console.error(`Error clearing ${table}:`, error);
    } else {
      console.log(`✅ Cleared ${table}`);
    }
  }
}

async function createTestUser(userData) {
  // First create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: userData.email,
    password: userData.password
  });

  if (authError) {
    console.error('Error creating auth user:', authError);
    return null;
  }

  // Then update user with role and status
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .update({
      role: userData.role,
      status: userData.status,
      email: userData.email
    })
    .eq('id', authData.user.id)
    .select()
    .single();

  if (profileError) {
    console.error('Error updating profile:', profileError);
    return null;
  }

  return { ...authData.user, profile };
}

async function createTestJob(ownerId, collaboratorIds = []) {
  // Add owner as collaborator
  const allCollaborators = [ownerId, ...collaboratorIds];

  const jobData = {
    venue: `Test Venue ${Date.now()}`,
    job_id: `JOB${Date.now()}`,
    owner_id: ownerId,
    created_by: ownerId,
    collaborators: allCollaborators,  // Array of user IDs
    status: 'draft',
    last_activity: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert(jobData)
    .select()
    .single();

  if (jobError) {
    console.error('Error creating job:', jobError);
    return null;
  }

  return job;
}

async function logActivity(action, userId, details = {}, success = true) {
  const { error } = await supabase
    .from('activity_logs')
    .insert({
      action,
      user_id: userId,
      details,
      success,
      timestamp: new Date().toISOString()
    });

  if (error) {
    console.error('Error logging activity:', error);
  }
}

async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }

  return data;
}

async function getJobById(jobId) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    console.error('Error fetching job:', error);
    return null;
  }

  return data;
}

async function getActivityLogs(limit = 100) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching activity logs:', error);
    return [];
  }

  return data;
}

// Test assertion helpers
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

function assertNotEqual(actual, expected, message) {
  if (actual === expected) {
    throw new Error(`${message}\nValue should not be: ${expected}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed: condition is not true');
  }
}

function assertFalse(condition, message) {
  if (condition) {
    throw new Error(message || 'Assertion failed: condition is not false');
  }
}

function assertExists(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value does not exist');
  }
}

function assertNotExists(value, message) {
  if (value !== null && value !== undefined) {
    throw new Error(message || 'Value should not exist');
  }
}

function assertArrayContains(array, item, message) {
  if (!array.includes(item)) {
    throw new Error(message || `Array does not contain: ${item}`);
  }
}

function assertArrayLength(array, expectedLength, message) {
  if (array.length !== expectedLength) {
    throw new Error(`${message || 'Array length mismatch'}\nExpected: ${expectedLength}\nActual: ${array.length}`);
  }
}

// Test runner
class TestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  addTest(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async run() {
    console.log('\n🧪 Starting Test Suite\n');
    console.log('=' .repeat(50));

    for (const test of this.tests) {
      try {
        await test.testFn();
        this.results.passed++;
        console.log(`✅ ${test.name}`);
      } catch (error) {
        this.results.failed++;
        this.results.errors.push({
          test: test.name,
          error: error.message
        });
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${error.message}`);
      }
    }

    console.log('\n' + '=' .repeat(50));
    console.log('📊 Test Results:');
    console.log(`   Passed: ${this.results.passed}`);
    console.log(`   Failed: ${this.results.failed}`);
    console.log(`   Total: ${this.tests.length}`);
    console.log(`   Success Rate: ${((this.results.passed / this.tests.length) * 100).toFixed(1)}%`);

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.errors.forEach((err, idx) => {
        console.log(`\n${idx + 1}. ${err.test}`);
        console.log(`   ${err.error}`);
      });
    }

    console.log('\n' + '=' .repeat(50) + '\n');

    return this.results;
  }
}

module.exports = {
  supabase,
  testUsers,
  clearDatabase,
  createTestUser,
  createTestJob,
  logActivity,
  getUserByEmail,
  getJobById,
  getActivityLogs,
  assertEqual,
  assertNotEqual,
  assertTrue,
  assertFalse,
  assertExists,
  assertNotExists,
  assertArrayContains,
  assertArrayLength,
  TestRunner
};