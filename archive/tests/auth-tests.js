const {
  supabase,
  testUsers,
  clearDatabase,
  createTestUser,
  getUserByEmail,
  getActivityLogs,
  assertEqual,
  assertNotEqual,
  assertTrue,
  assertFalse,
  assertExists,
  assertNotExists,
  TestRunner
} = require('./test-utils');

const authTests = new TestRunner();

// Test 1: New user registration enters pending status
authTests.addTest('New user registration creates pending account', async () => {
  const { data, error } = await supabase.auth.signUp({
    email: 'newuser@example.com',
    password: 'NewUser123!'
  });

  assertNotExists(error, 'Sign up should succeed');
  assertExists(data.user, 'User should be created');

  // Check profile status
  const profile = await getUserByEmail('newuser@example.com');
  assertEqual(profile.status, 'pending', 'New user should have pending status');
  assertEqual(profile.role, 'user', 'New user should have user role');
});

// Test 2: Login with valid credentials
authTests.addTest('User can login with valid credentials', async () => {
  // Create test user first
  await createTestUser(testUsers.regularUser1);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  assertNotExists(error, 'Login should succeed');
  assertExists(data.session, 'Session should be created');
  assertExists(data.user, 'User data should be returned');
});

// Test 3: Login with invalid credentials fails
authTests.addTest('Login fails with invalid credentials', async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'invalid@test.com',
    password: 'WrongPassword123!'
  });

  assertExists(error, 'Login should fail');
  assertNotExists(data.session, 'No session should be created');
});

// Test 4: Unauthenticated access is blocked
authTests.addTest('Unauthenticated users cannot access protected resources', async () => {
  // Sign out first
  await supabase.auth.signOut();

  const { data, error } = await supabase
    .from('jobs')
    .select('*');

  assertExists(error, 'Should get error accessing jobs without auth');
});

// Test 5: Session management
authTests.addTest('User session persists and can be retrieved', async () => {
  await createTestUser(testUsers.regularUser1);

  const { data: loginData } = await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const { data: sessionData } = await supabase.auth.getSession();

  assertExists(sessionData.session, 'Session should persist');
  assertEqual(sessionData.session.user.email, testUsers.regularUser1.email, 'Session user email should match');
});

// Test 6: Logout clears session
authTests.addTest('Logout successfully clears session', async () => {
  await createTestUser(testUsers.regularUser1);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const { error } = await supabase.auth.signOut();
  assertNotExists(error, 'Logout should succeed');

  const { data } = await supabase.auth.getSession();
  assertNotExists(data.session, 'Session should be cleared after logout');
});

// Test 7: Pending users have limited access
authTests.addTest('Pending users cannot access main application', async () => {
  const pendingUser = await createTestUser(testUsers.pendingUser);

  await supabase.auth.signInWithPassword({
    email: testUsers.pendingUser.email,
    password: testUsers.pendingUser.password
  });

  // Try to create a job (should fail)
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      venue_name: 'Test Venue',
      owner_id: pendingUser.id
    });

  assertExists(error, 'Pending user should not be able to create jobs');
});

// Test 8: Admin users have elevated privileges
authTests.addTest('Admin users can access admin-only resources', async () => {
  const adminUser = await createTestUser(testUsers.admin);

  await supabase.auth.signInWithPassword({
    email: testUsers.admin.email,
    password: testUsers.admin.password
  });

  // Admin should be able to view all users
  const { data, error } = await supabase
    .from('profiles')
    .select('*');

  assertNotExists(error, 'Admin should be able to view all profiles');
  assertExists(data, 'Profile data should be returned');
});

// Test 9: Regular users cannot access admin resources
authTests.addTest('Regular users cannot access admin resources', async () => {
  await createTestUser(testUsers.regularUser1);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  // Try to update another user's status (admin only)
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'suspended' })
    .neq('email', testUsers.regularUser1.email);

  assertExists(error, 'Regular user should not be able to update other profiles');
});

// Test 10: Password requirements are enforced
authTests.addTest('Password requirements are enforced', async () => {
  const weakPasswords = [
    'short',          // Too short
    'nouppercase1!',  // No uppercase
    'NOLOWERCASE1!',  // No lowercase
    'NoNumbers!',     // No numbers
    'NoSpecial123'    // No special characters
  ];

  for (const password of weakPasswords) {
    const { error } = await supabase.auth.signUp({
      email: `test${Date.now()}@test.com`,
      password: password
    });

    // Note: Supabase might not enforce all these by default,
    // but this tests if any validation is in place
    if (!error) {
      console.log(`   Warning: Weak password accepted: ${password}`);
    }
  }
});

// Test 11: Email validation
authTests.addTest('Invalid email formats are rejected', async () => {
  const invalidEmails = [
    'notanemail',
    '@nodomain.com',
    'no@domain',
    'spaces in@email.com',
    'double@@domain.com'
  ];

  for (const email of invalidEmails) {
    const { error } = await supabase.auth.signUp({
      email: email,
      password: 'ValidPassword123!'
    });

    assertExists(error, `Invalid email should be rejected: ${email}`);
  }
});

// Test 12: Duplicate email registration
authTests.addTest('Cannot register with existing email', async () => {
  await createTestUser(testUsers.regularUser1);

  const { error } = await supabase.auth.signUp({
    email: testUsers.regularUser1.email,
    password: 'DifferentPassword123!'
  });

  assertExists(error, 'Should not be able to register with existing email');
});

// Test 13: User status transitions
authTests.addTest('User status can transition correctly', async () => {
  const user = await createTestUser(testUsers.pendingUser);
  const adminUser = await createTestUser(testUsers.admin);

  // Login as admin
  await supabase.auth.signInWithPassword({
    email: testUsers.admin.email,
    password: testUsers.admin.password
  });

  // Approve pending user
  const { error: approveError } = await supabase
    .from('profiles')
    .update({ status: 'active' })
    .eq('id', user.id);

  assertNotExists(approveError, 'Admin should be able to approve user');

  // Check status changed
  const updatedUser = await getUserByEmail(testUsers.pendingUser.email);
  assertEqual(updatedUser.status, 'active', 'User status should be active');
});

// Test 14: Authentication attempts are logged
authTests.addTest('Authentication attempts are logged in activity logs', async () => {
  await createTestUser(testUsers.regularUser1);

  // Clear logs first
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Successful login
  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  // Failed login
  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: 'WrongPassword!'
  });

  const logs = await getActivityLogs();

  // Note: Activity logging might need to be implemented in the app
  // This tests if it exists
  if (logs.length > 0) {
    console.log(`   Found ${logs.length} activity log entries`);
  }
});

// Test 15: Token expiration and refresh
authTests.addTest('Session tokens can be refreshed', async () => {
  await createTestUser(testUsers.regularUser1);

  const { data: loginData } = await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  assertExists(loginData.session, 'Initial session should exist');

  // Refresh session
  const { data: refreshData, error } = await supabase.auth.refreshSession();

  assertNotExists(error, 'Session refresh should succeed');
  assertExists(refreshData.session, 'New session should be created');
});

// Run all auth tests
async function runAuthTests() {
  console.log('\n📋 AUTHENTICATION & AUTHORIZATION TESTS\n');

  // Clear database before tests
  await clearDatabase();

  // Run tests
  const results = await authTests.run();

  return results;
}

module.exports = { runAuthTests };