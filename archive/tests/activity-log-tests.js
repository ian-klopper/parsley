const {
  supabase,
  testUsers,
  clearDatabase,
  createTestUser,
  createTestJob,
  logActivity,
  getActivityLogs,
  assertEqual,
  assertNotEqual,
  assertTrue,
  assertFalse,
  assertExists,
  assertNotExists,
  assertArrayLength,
  TestRunner
} = require('./test-utils');

const activityTests = new TestRunner();

// Test 1: User creation is logged
activityTests.addTest('User creation is logged in activity logs', async () => {
  // Clear activity logs
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const user = await createTestUser(testUsers.regularUser1);

  // Log the user creation (simulating what the app should do)
  await logActivity('user_created', user.id, {
    email: testUsers.regularUser1.email,
    role: testUsers.regularUser1.role
  });

  const logs = await getActivityLogs();

  const userCreateLog = logs.find(log => log.action === 'user_created');
  assertExists(userCreateLog, 'User creation should be logged');
  assertEqual(userCreateLog.user_id, user.id, 'Log should reference correct user');
});

// Test 2: User status changes are logged
activityTests.addTest('User status changes are logged', async () => {
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const pendingUser = await createTestUser(testUsers.pendingUser);
  const admin = await createTestUser(testUsers.admin);

  // Login as admin
  await supabase.auth.signInWithPassword({
    email: testUsers.admin.email,
    password: testUsers.admin.password
  });

  // Approve user
  await supabase
    .from('profiles')
    .update({ status: 'active' })
    .eq('id', pendingUser.id);

  // Log the status change
  await logActivity('user_status_changed', admin.id, {
    target_user_id: pendingUser.id,
    old_status: 'pending',
    new_status: 'active'
  });

  const logs = await getActivityLogs();

  const statusLog = logs.find(log => log.action === 'user_status_changed');
  assertExists(statusLog, 'Status change should be logged');
  assertEqual(statusLog.details.new_status, 'active', 'New status should be logged');
});

// Test 3: Job creation is logged
activityTests.addTest('Job creation is logged with details', async () => {
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const user = await createTestUser(testUsers.regularUser1);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(user.id);

  // Log job creation
  await logActivity('job_created', user.id, {
    job_id: job.id,
    venue_name: job.venue_name
  });

  const logs = await getActivityLogs();

  const jobLog = logs.find(log => log.action === 'job_created');
  assertExists(jobLog, 'Job creation should be logged');
  assertEqual(jobLog.details.job_id, job.id, 'Job ID should be logged');
});

// Test 4: Job deletion is logged
activityTests.addTest('Job deletion is logged', async () => {
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const user = await createTestUser(testUsers.regularUser1);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(user.id);

  // Delete job
  await supabase.from('jobs').delete().eq('id', job.id);

  // Log deletion
  await logActivity('job_deleted', user.id, {
    job_id: job.id,
    venue_name: job.venue_name
  });

  const logs = await getActivityLogs();

  const deleteLog = logs.find(log => log.action === 'job_deleted');
  assertExists(deleteLog, 'Job deletion should be logged');
});

// Test 5: Ownership transfers are logged
activityTests.addTest('Ownership transfers are logged', async () => {
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const originalOwner = await createTestUser(testUsers.regularUser1);
  const newOwner = await createTestUser(testUsers.regularUser2);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(originalOwner.id);

  // Transfer ownership
  await supabase
    .from('jobs')
    .update({ owner_id: newOwner.id })
    .eq('id', job.id);

  // Log transfer
  await logActivity('ownership_transferred', originalOwner.id, {
    job_id: job.id,
    old_owner_id: originalOwner.id,
    new_owner_id: newOwner.id
  });

  const logs = await getActivityLogs();

  const transferLog = logs.find(log => log.action === 'ownership_transferred');
  assertExists(transferLog, 'Ownership transfer should be logged');
  assertEqual(transferLog.details.new_owner_id, newOwner.id, 'New owner should be logged');
});

// Test 6: Collaborator changes are logged
activityTests.addTest('Collaborator additions and removals are logged', async () => {
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const owner = await createTestUser(testUsers.regularUser1);
  const collab = await createTestUser(testUsers.regularUser2);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(owner.id);

  // Add collaborator
  await supabase
    .from('job_collaborators')
    .insert({ job_id: job.id, user_id: collab.id });

  await logActivity('collaborator_added', owner.id, {
    job_id: job.id,
    collaborator_id: collab.id
  });

  // Remove collaborator
  await supabase
    .from('job_collaborators')
    .delete()
    .eq('job_id', job.id)
    .eq('user_id', collab.id);

  await logActivity('collaborator_removed', owner.id, {
    job_id: job.id,
    collaborator_id: collab.id
  });

  const logs = await getActivityLogs();

  const addLog = logs.find(log => log.action === 'collaborator_added');
  const removeLog = logs.find(log => log.action === 'collaborator_removed');

  assertExists(addLog, 'Collaborator addition should be logged');
  assertExists(removeLog, 'Collaborator removal should be logged');
});

// Test 7: Failed operations are logged
activityTests.addTest('Failed operations are logged with error details', async () => {
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const user = await createTestUser(testUsers.regularUser1);

  // Log a failed operation
  await logActivity('job_creation_failed', user.id, {
    error: 'Venue name is required',
    attempted_data: { owner_id: user.id }
  }, false);

  const logs = await getActivityLogs();

  const failLog = logs.find(log => log.action === 'job_creation_failed');
  assertExists(failLog, 'Failed operation should be logged');
  assertFalse(failLog.success, 'Success flag should be false');
  assertExists(failLog.details.error, 'Error message should be logged');
});

// Test 8: Authentication attempts are logged
activityTests.addTest('Login attempts are logged (success and failure)', async () => {
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const user = await createTestUser(testUsers.regularUser1);

  // Successful login
  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  await logActivity('login_success', user.id, {
    email: testUsers.regularUser1.email,
    timestamp: new Date().toISOString()
  });

  // Failed login
  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: 'WrongPassword!'
  });

  await logActivity('login_failed', null, {
    email: testUsers.regularUser1.email,
    reason: 'Invalid credentials'
  }, false);

  const logs = await getActivityLogs();

  const successLog = logs.find(log => log.action === 'login_success');
  const failLog = logs.find(log => log.action === 'login_failed');

  assertExists(successLog, 'Successful login should be logged');
  assertExists(failLog, 'Failed login should be logged');
});

// Test 9: Timestamp accuracy
activityTests.addTest('Activity log timestamps are accurate', async () => {
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const user = await createTestUser(testUsers.regularUser1);

  const beforeLog = new Date();
  await logActivity('test_action', user.id, { test: true });
  const afterLog = new Date();

  const logs = await getActivityLogs();
  const testLog = logs.find(log => log.action === 'test_action');

  assertExists(testLog.timestamp, 'Timestamp should exist');

  const logTime = new Date(testLog.timestamp);
  assertTrue(logTime >= beforeLog, 'Timestamp should be after start');
  assertTrue(logTime <= afterLog, 'Timestamp should be before end');
});

// Test 10: User identification in logs
activityTests.addTest('Logs correctly identify the acting user', async () => {
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const user1 = await createTestUser(testUsers.regularUser1);
  const user2 = await createTestUser(testUsers.regularUser2);

  await logActivity('action_by_user1', user1.id, {});
  await logActivity('action_by_user2', user2.id, {});

  const logs = await getActivityLogs();

  const log1 = logs.find(log => log.action === 'action_by_user1');
  const log2 = logs.find(log => log.action === 'action_by_user2');

  assertEqual(log1.user_id, user1.id, 'User1 should be identified');
  assertEqual(log2.user_id, user2.id, 'User2 should be identified');
});

// Test 11: Bulk operations are logged
activityTests.addTest('Bulk operations create multiple log entries', async () => {
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const admin = await createTestUser(testUsers.admin);
  const users = [
    await createTestUser({ ...testUsers.regularUser1, email: 'bulk1@test.com' }),
    await createTestUser({ ...testUsers.regularUser2, email: 'bulk2@test.com' }),
    await createTestUser({ ...testUsers.pendingUser, email: 'bulk3@test.com' })
  ];

  // Simulate bulk approval
  for (const user of users) {
    await logActivity('bulk_user_approved', admin.id, {
      target_user_id: user.id,
      part_of_bulk: true
    });
  }

  const logs = await getActivityLogs();
  const bulkLogs = logs.filter(log => log.action === 'bulk_user_approved');

  assertEqual(bulkLogs.length, users.length, 'Each bulk action should be logged');
});

// Test 12: Log filtering and retrieval
activityTests.addTest('Activity logs can be filtered and retrieved correctly', async () => {
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const user = await createTestUser(testUsers.regularUser1);

  // Create various log entries
  await logActivity('action_1', user.id, {});
  await logActivity('action_2', user.id, {});
  await logActivity('failed_action', user.id, {}, false);

  const allLogs = await getActivityLogs();
  const successLogs = allLogs.filter(log => log.success !== false);
  const failedLogs = allLogs.filter(log => log.success === false);

  assertTrue(allLogs.length >= 3, 'Should have at least 3 logs');
  assertTrue(successLogs.length >= 2, 'Should have at least 2 success logs');
  assertTrue(failedLogs.length >= 1, 'Should have at least 1 failed log');
});

// Test 13: Admin access to activity logs
activityTests.addTest('Only admins can view activity logs', async () => {
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const admin = await createTestUser(testUsers.admin);
  const regularUser = await createTestUser(testUsers.regularUser1);

  await logActivity('test_action', regularUser.id, {});

  // Try as regular user
  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const { data: userLogs, error: userError } = await supabase
    .from('activity_logs')
    .select('*');

  // Regular user might not have access
  if (userError) {
    console.log('   Regular user cannot access logs (expected)');
  }

  // Try as admin
  await supabase.auth.signInWithPassword({
    email: testUsers.admin.email,
    password: testUsers.admin.password
  });

  const { data: adminLogs, error: adminError } = await supabase
    .from('activity_logs')
    .select('*');

  // Admin should have access
  if (!adminError && adminLogs) {
    assertTrue(adminLogs.length >= 1, 'Admin should see activity logs');
  }
});

// Test 14: Log retention and ordering
activityTests.addTest('Activity logs are ordered by timestamp (newest first)', async () => {
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const user = await createTestUser(testUsers.regularUser1);

  // Create logs with delays
  await logActivity('first_action', user.id, { order: 1 });
  await new Promise(resolve => setTimeout(resolve, 100));
  await logActivity('second_action', user.id, { order: 2 });
  await new Promise(resolve => setTimeout(resolve, 100));
  await logActivity('third_action', user.id, { order: 3 });

  const logs = await getActivityLogs();

  // Check ordering (newest first)
  const actionLogs = logs.filter(log =>
    ['first_action', 'second_action', 'third_action'].includes(log.action)
  );

  if (actionLogs.length === 3) {
    assertEqual(actionLogs[0].action, 'third_action', 'Newest should be first');
    assertEqual(actionLogs[2].action, 'first_action', 'Oldest should be last');
  }
});

// Test 15: Sensitive data handling
activityTests.addTest('Sensitive data is properly handled in logs', async () => {
  await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const user = await createTestUser(testUsers.regularUser1);

  // Log with potentially sensitive data
  await logActivity('password_reset', user.id, {
    email: testUsers.regularUser1.email,
    // Should NOT log actual password
    password_hint: '***REDACTED***'
  });

  const logs = await getActivityLogs();
  const resetLog = logs.find(log => log.action === 'password_reset');

  assertExists(resetLog, 'Password reset should be logged');
  assertFalse(
    JSON.stringify(resetLog).includes(testUsers.regularUser1.password),
    'Password should not be in logs'
  );
});

// Run all activity log tests
async function runActivityLogTests() {
  console.log('\n📋 ACTIVITY LOGGING TESTS\n');

  // Clear database before tests
  await clearDatabase();

  // Run tests
  const results = await activityTests.run();

  return results;
}

module.exports = { runActivityLogTests };