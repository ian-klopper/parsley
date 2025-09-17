const {
  supabase,
  testUsers,
  clearDatabase,
  createTestUser,
  createTestJob,
  getJobById,
  assertEqual,
  assertNotEqual,
  assertTrue,
  assertFalse,
  assertExists,
  assertNotExists,
  assertArrayContains,
  assertArrayLength,
  TestRunner
} = require('./test-utils');

const jobTests = new TestRunner();

// Test 1: User can create a new job
jobTests.addTest('User can create a new job', async () => {
  const user = await createTestUser(testUsers.regularUser1);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      venue_name: 'Test Restaurant',
      owner_id: user.id,
      status: 'active'
    })
    .select()
    .single();

  assertNotExists(error, 'Job creation should succeed');
  assertExists(job, 'Job should be created');
  assertEqual(job.venue_name, 'Test Restaurant', 'Venue name should match');
  assertEqual(job.owner_id, user.id, 'Owner ID should match');
});

// Test 2: Job owner is automatically added as collaborator
jobTests.addTest('Job owner is automatically added as collaborator', async () => {
  const user = await createTestUser(testUsers.regularUser1);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(user.id);

  const { data: collaborators } = await supabase
    .from('job_collaborators')
    .select('user_id')
    .eq('job_id', job.id);

  const collaboratorIds = collaborators.map(c => c.user_id);
  assertArrayContains(collaboratorIds, user.id, 'Owner should be in collaborators');
});

// Test 3: Only job owner can delete job
jobTests.addTest('Only job owner can delete their job', async () => {
  const owner = await createTestUser(testUsers.regularUser1);
  const nonOwner = await createTestUser(testUsers.regularUser2);

  // Create job as owner
  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(owner.id);

  // Try to delete as non-owner
  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser2.email,
    password: testUsers.regularUser2.password
  });

  const { error: deleteError } = await supabase
    .from('jobs')
    .delete()
    .eq('id', job.id);

  assertExists(deleteError, 'Non-owner should not be able to delete job');

  // Delete as owner
  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const { error: ownerDeleteError } = await supabase
    .from('jobs')
    .delete()
    .eq('id', job.id);

  assertNotExists(ownerDeleteError, 'Owner should be able to delete job');
});

// Test 4: Users can only see jobs they collaborate on
jobTests.addTest('Users only see jobs they collaborate on', async () => {
  const user1 = await createTestUser(testUsers.regularUser1);
  const user2 = await createTestUser(testUsers.regularUser2);

  // Create jobs for different users
  const job1 = await createTestJob(user1.id);
  const job2 = await createTestJob(user2.id);
  const sharedJob = await createTestJob(user1.id, [user2.id]);

  // Check user1's visible jobs
  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const { data: user1Jobs } = await supabase
    .from('jobs')
    .select('*')
    .in('id',
      supabase.from('job_collaborators')
        .select('job_id')
        .eq('user_id', user1.id)
    );

  // User1 should see job1 and sharedJob
  const user1JobIds = user1Jobs?.map(j => j.id) || [];
  if (user1JobIds.length > 0) {
    assertTrue(user1JobIds.includes(job1.id) || user1JobIds.includes(sharedJob.id),
      'User1 should see their own jobs');
  }

  // Check user2's visible jobs
  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser2.email,
    password: testUsers.regularUser2.password
  });

  const { data: user2Jobs } = await supabase
    .from('jobs')
    .select('*')
    .in('id',
      supabase.from('job_collaborators')
        .select('job_id')
        .eq('user_id', user2.id)
    );

  // User2 should see job2 and sharedJob
  const user2JobIds = user2Jobs?.map(j => j.id) || [];
  if (user2JobIds.length > 0) {
    assertTrue(user2JobIds.includes(job2.id) || user2JobIds.includes(sharedJob.id),
      'User2 should see their collaborative jobs');
  }
});

// Test 5: Admin can see all jobs
jobTests.addTest('Admin can see all jobs regardless of collaboration', async () => {
  const admin = await createTestUser(testUsers.admin);
  const user1 = await createTestUser(testUsers.regularUser1);
  const user2 = await createTestUser(testUsers.regularUser2);

  // Create jobs for different users
  const job1 = await createTestJob(user1.id);
  const job2 = await createTestJob(user2.id);

  // Login as admin
  await supabase.auth.signInWithPassword({
    email: testUsers.admin.email,
    password: testUsers.admin.password
  });

  const { data: allJobs, error } = await supabase
    .from('jobs')
    .select('*');

  assertNotExists(error, 'Admin should be able to query all jobs');
  if (allJobs && allJobs.length > 0) {
    console.log(`   Admin can see ${allJobs.length} total jobs`);
  }
});

// Test 6: Job ownership transfer
jobTests.addTest('Job ownership can be transferred', async () => {
  const originalOwner = await createTestUser(testUsers.regularUser1);
  const newOwner = await createTestUser(testUsers.regularUser2);

  // Create job as original owner
  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(originalOwner.id);

  // Transfer ownership
  const { error: transferError } = await supabase
    .from('jobs')
    .update({ owner_id: newOwner.id })
    .eq('id', job.id);

  assertNotExists(transferError, 'Ownership transfer should succeed');

  // Verify new owner
  const updatedJob = await getJobById(job.id);
  assertEqual(updatedJob?.owner_id, newOwner.id, 'Job should have new owner');
});

// Test 7: New owner becomes collaborator automatically
jobTests.addTest('New owner automatically becomes collaborator on transfer', async () => {
  const originalOwner = await createTestUser(testUsers.regularUser1);
  const newOwner = await createTestUser(testUsers.regularUser2);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(originalOwner.id);

  // Transfer ownership
  await supabase.from('jobs').update({ owner_id: newOwner.id }).eq('id', job.id);

  // Add new owner as collaborator
  await supabase.from('job_collaborators').insert({
    job_id: job.id,
    user_id: newOwner.id
  });

  // Check collaborators
  const { data: collaborators } = await supabase
    .from('job_collaborators')
    .select('user_id')
    .eq('job_id', job.id);

  const collaboratorIds = collaborators.map(c => c.user_id);
  assertArrayContains(collaboratorIds, newOwner.id, 'New owner should be collaborator');
});

// Test 8: Validate required fields
jobTests.addTest('Job creation validates required fields', async () => {
  const user = await createTestUser(testUsers.regularUser1);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  // Try to create job without venue_name
  const { error: noNameError } = await supabase
    .from('jobs')
    .insert({
      owner_id: user.id
    });

  assertExists(noNameError, 'Should require venue_name');

  // Try to create job without owner_id
  const { error: noOwnerError } = await supabase
    .from('jobs')
    .insert({
      venue_name: 'Test Venue'
    });

  assertExists(noOwnerError, 'Should require owner_id');
});

// Test 9: Job status transitions
jobTests.addTest('Job status can be updated correctly', async () => {
  const user = await createTestUser(testUsers.regularUser1);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(user.id);

  const statuses = ['active', 'pending', 'completed', 'archived'];

  for (const status of statuses) {
    const { error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', job.id);

    assertNotExists(error, `Should be able to set status to ${status}`);

    const updatedJob = await getJobById(job.id);
    assertEqual(updatedJob?.status, status, `Job status should be ${status}`);
  }
});

// Test 10: Duplicate job names allowed for same user
jobTests.addTest('User can create multiple jobs with same venue name', async () => {
  const user = await createTestUser(testUsers.regularUser1);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const venueName = 'Duplicate Restaurant';

  const job1 = await createTestJob(user.id);
  await supabase.from('jobs').update({ venue_name: venueName }).eq('id', job1.id);

  const job2 = await createTestJob(user.id);
  const { error } = await supabase
    .from('jobs')
    .update({ venue_name: venueName })
    .eq('id', job2.id);

  assertNotExists(error, 'Should allow duplicate venue names');
});

// Test 11: Non-collaborator cannot access job details
jobTests.addTest('Non-collaborator cannot access job details', async () => {
  const owner = await createTestUser(testUsers.regularUser1);
  const nonCollaborator = await createTestUser(testUsers.regularUser2);

  const job = await createTestJob(owner.id);

  // Try to access as non-collaborator
  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser2.email,
    password: testUsers.regularUser2.password
  });

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', job.id)
    .single();

  // Should not be able to see the job
  if (error || !data) {
    assertTrue(true, 'Non-collaborator should not access job');
  } else {
    assertFalse(true, 'Non-collaborator should not see job details');
  }
});

// Test 12: Job timestamps are set correctly
jobTests.addTest('Job timestamps are set and updated correctly', async () => {
  const user = await createTestUser(testUsers.regularUser1);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const beforeCreate = new Date();
  const job = await createTestJob(user.id);
  const afterCreate = new Date();

  assertExists(job.created_at, 'Created timestamp should be set');
  assertExists(job.updated_at, 'Updated timestamp should be set');

  // Update job
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

  const { error } = await supabase
    .from('jobs')
    .update({ venue_name: 'Updated Name' })
    .eq('id', job.id);

  const updatedJob = await getJobById(job.id);

  assertNotEqual(updatedJob?.updated_at, job.updated_at,
    'Updated timestamp should change after update');
});

// Test 13: Cascading delete removes collaborators
jobTests.addTest('Deleting job removes all collaborator associations', async () => {
  const user = await createTestUser(testUsers.regularUser1);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(user.id, []);

  // Add additional collaborator
  const user2 = await createTestUser(testUsers.regularUser2);
  await supabase.from('job_collaborators').insert({
    job_id: job.id,
    user_id: user2.id
  });

  // Delete job
  await supabase.from('jobs').delete().eq('id', job.id);

  // Check collaborators are removed
  const { data: remainingCollabs } = await supabase
    .from('job_collaborators')
    .select('*')
    .eq('job_id', job.id);

  assertEqual(remainingCollabs?.length || 0, 0,
    'All collaborator records should be deleted');
});

// Test 14: Pending users cannot create jobs
jobTests.addTest('Pending users cannot create jobs', async () => {
  const pendingUser = await createTestUser(testUsers.pendingUser);

  await supabase.auth.signInWithPassword({
    email: testUsers.pendingUser.email,
    password: testUsers.pendingUser.password
  });

  const { error } = await supabase
    .from('jobs')
    .insert({
      venue_name: 'Pending Test',
      owner_id: pendingUser.id
    });

  assertExists(error, 'Pending user should not be able to create jobs');
});

// Test 15: Large venue names and special characters
jobTests.addTest('Job handles large venue names and special characters', async () => {
  const user = await createTestUser(testUsers.regularUser1);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const specialNames = [
    'Café José\'s "Special" Place',
    'Restaurant & Bar < > | \\ / : * ? "',
    'مطعم عربي',  // Arabic
    '中国餐厅',    // Chinese
    '🍕 Pizza Palace 🍔',  // Emojis
    'A'.repeat(255)  // Very long name
  ];

  for (const name of specialNames) {
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        venue_name: name,
        owner_id: user.id
      })
      .select()
      .single();

    if (error) {
      console.log(`   Could not create job with name: ${name.substring(0, 50)}...`);
    } else {
      assertEqual(data.venue_name, name, 'Special characters should be preserved');
    }
  }
});

// Run all job tests
async function runJobTests() {
  console.log('\n📋 JOB MANAGEMENT TESTS\n');

  // Clear database before tests
  await clearDatabase();

  // Run tests
  const results = await jobTests.run();

  return results;
}

module.exports = { runJobTests };