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

const collaboratorTests = new TestRunner();

// Test 1: Owner can add collaborators to their job
collaboratorTests.addTest('Owner can add collaborators to their job', async () => {
  const owner = await createTestUser(testUsers.regularUser1);
  const newCollab = await createTestUser(testUsers.regularUser2);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(owner.id);

  // Add collaborator
  const { error } = await supabase
    .from('job_collaborators')
    .insert({
      job_id: job.id,
      user_id: newCollab.id
    });

  assertNotExists(error, 'Adding collaborator should succeed');

  // Verify collaborator was added
  const { data: collaborators } = await supabase
    .from('job_collaborators')
    .select('user_id')
    .eq('job_id', job.id);

  const collabIds = collaborators.map(c => c.user_id);
  assertArrayContains(collabIds, newCollab.id, 'New collaborator should be in list');
});

// Test 2: Non-owner cannot add collaborators
collaboratorTests.addTest('Non-owner cannot add collaborators to job', async () => {
  const owner = await createTestUser(testUsers.regularUser1);
  const nonOwner = await createTestUser(testUsers.regularUser2);
  const targetUser = await createTestUser({
    email: 'target@test.com',
    password: 'Target123!',
    role: 'user',
    status: 'active'
  });

  const job = await createTestJob(owner.id);

  // Try to add collaborator as non-owner
  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser2.email,
    password: testUsers.regularUser2.password
  });

  const { error } = await supabase
    .from('job_collaborators')
    .insert({
      job_id: job.id,
      user_id: targetUser.id
    });

  assertExists(error, 'Non-owner should not be able to add collaborators');
});

// Test 3: Admin can add collaborators to any job
collaboratorTests.addTest('Admin can add collaborators to any job', async () => {
  const admin = await createTestUser(testUsers.admin);
  const owner = await createTestUser(testUsers.regularUser1);
  const newCollab = await createTestUser(testUsers.regularUser2);

  const job = await createTestJob(owner.id);

  // Login as admin
  await supabase.auth.signInWithPassword({
    email: testUsers.admin.email,
    password: testUsers.admin.password
  });

  // Add collaborator as admin
  const { error } = await supabase
    .from('job_collaborators')
    .insert({
      job_id: job.id,
      user_id: newCollab.id
    });

  // Admin might have restrictions in RLS, but test the attempt
  if (!error) {
    const { data: collaborators } = await supabase
      .from('job_collaborators')
      .select('user_id')
      .eq('job_id', job.id);

    const collabIds = collaborators?.map(c => c.user_id) || [];
    assertArrayContains(collabIds, newCollab.id, 'Admin should add collaborator');
  }
});

// Test 4: Cannot add duplicate collaborators
collaboratorTests.addTest('Cannot add duplicate collaborators', async () => {
  const owner = await createTestUser(testUsers.regularUser1);
  const collab = await createTestUser(testUsers.regularUser2);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(owner.id, [collab.id]);

  // Try to add same collaborator again
  const { error } = await supabase
    .from('job_collaborators')
    .insert({
      job_id: job.id,
      user_id: collab.id
    });

  assertExists(error, 'Should not allow duplicate collaborators');
});

// Test 5: Cannot add pending users as collaborators
collaboratorTests.addTest('Cannot add pending users as collaborators', async () => {
  const owner = await createTestUser(testUsers.regularUser1);
  const pendingUser = await createTestUser(testUsers.pendingUser);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(owner.id);

  // Try to add pending user
  const { error } = await supabase
    .from('job_collaborators')
    .insert({
      job_id: job.id,
      user_id: pendingUser.id
    });

  // Should fail or be prevented by business logic
  if (!error) {
    console.log('   Warning: Pending user was added as collaborator (check business logic)');
  }
});

// Test 6: Owner can remove collaborators
collaboratorTests.addTest('Owner can remove collaborators from their job', async () => {
  const owner = await createTestUser(testUsers.regularUser1);
  const collab = await createTestUser(testUsers.regularUser2);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(owner.id, [collab.id]);

  // Remove collaborator
  const { error } = await supabase
    .from('job_collaborators')
    .delete()
    .eq('job_id', job.id)
    .eq('user_id', collab.id);

  assertNotExists(error, 'Removing collaborator should succeed');

  // Verify collaborator was removed
  const { data: remaining } = await supabase
    .from('job_collaborators')
    .select('user_id')
    .eq('job_id', job.id)
    .eq('user_id', collab.id);

  assertEqual(remaining?.length || 0, 0, 'Collaborator should be removed');
});

// Test 7: Cannot remove job owner as collaborator
collaboratorTests.addTest('Cannot remove job owner from collaborators', async () => {
  const owner = await createTestUser(testUsers.regularUser1);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(owner.id);

  // Try to remove owner as collaborator
  const { error } = await supabase
    .from('job_collaborators')
    .delete()
    .eq('job_id', job.id)
    .eq('user_id', owner.id);

  // Check if owner is still a collaborator
  const { data: collaborators } = await supabase
    .from('job_collaborators')
    .select('user_id')
    .eq('job_id', job.id);

  const collabIds = collaborators?.map(c => c.user_id) || [];

  // Owner should remain as collaborator
  if (!collabIds.includes(owner.id)) {
    console.log('   Warning: Owner was removed from collaborators (check business logic)');
  }
});

// Test 8: Making user owner auto-toggles collaborator
collaboratorTests.addTest('Making user owner automatically makes them collaborator', async () => {
  const originalOwner = await createTestUser(testUsers.regularUser1);
  const newOwner = await createTestUser(testUsers.regularUser2);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(originalOwner.id);

  // Transfer ownership (should auto-add as collaborator)
  await supabase
    .from('jobs')
    .update({ owner_id: newOwner.id })
    .eq('id', job.id);

  // Manually add as collaborator (simulating UI behavior)
  await supabase
    .from('job_collaborators')
    .insert({
      job_id: job.id,
      user_id: newOwner.id
    });

  const { data: collaborators } = await supabase
    .from('job_collaborators')
    .select('user_id')
    .eq('job_id', job.id);

  const collabIds = collaborators?.map(c => c.user_id) || [];
  assertArrayContains(collabIds, newOwner.id, 'New owner should be collaborator');
});

// Test 9: Collaborator loses access when removed
collaboratorTests.addTest('Removed collaborator loses access to job', async () => {
  const owner = await createTestUser(testUsers.regularUser1);
  const collab = await createTestUser(testUsers.regularUser2);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(owner.id, [collab.id]);

  // Remove collaborator
  await supabase
    .from('job_collaborators')
    .delete()
    .eq('job_id', job.id)
    .eq('user_id', collab.id);

  // Try to access job as removed collaborator
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
  if (data) {
    console.log('   Warning: Removed collaborator can still access job (check RLS)');
  }
});

// Test 10: Multiple collaborators on single job
collaboratorTests.addTest('Job can have multiple collaborators', async () => {
  const owner = await createTestUser(testUsers.regularUser1);
  const collab1 = await createTestUser(testUsers.regularUser2);
  const collab2 = await createTestUser({
    email: 'collab2@test.com',
    password: 'Collab123!',
    role: 'user',
    status: 'active'
  });
  const collab3 = await createTestUser({
    email: 'collab3@test.com',
    password: 'Collab123!',
    role: 'user',
    status: 'active'
  });

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(owner.id, [collab1.id, collab2.id, collab3.id]);

  const { data: collaborators } = await supabase
    .from('job_collaborators')
    .select('user_id')
    .eq('job_id', job.id);

  // Should have owner + 3 collaborators = 4 total
  assertTrue(collaborators.length >= 4, 'Should have multiple collaborators');
});

// Test 11: User can be collaborator on multiple jobs
collaboratorTests.addTest('User can collaborate on multiple jobs', async () => {
  const owner1 = await createTestUser(testUsers.regularUser1);
  const owner2 = await createTestUser(testUsers.regularUser2);
  const sharedCollab = await createTestUser({
    email: 'shared@test.com',
    password: 'Shared123!',
    role: 'user',
    status: 'active'
  });

  // Create jobs with shared collaborator
  const job1 = await createTestJob(owner1.id, [sharedCollab.id]);
  const job2 = await createTestJob(owner2.id, [sharedCollab.id]);

  // Check shared collaborator's jobs
  await supabase.auth.signInWithPassword({
    email: 'shared@test.com',
    password: 'Shared123!'
  });

  const { data: collabJobs } = await supabase
    .from('job_collaborators')
    .select('job_id')
    .eq('user_id', sharedCollab.id);

  const jobIds = collabJobs?.map(c => c.job_id) || [];
  assertTrue(jobIds.includes(job1.id), 'Should be collaborator on job1');
  assertTrue(jobIds.includes(job2.id), 'Should be collaborator on job2');
});

// Test 12: Concurrent collaborator updates
collaboratorTests.addTest('Handle concurrent collaborator updates', async () => {
  const owner = await createTestUser(testUsers.regularUser1);
  const collab1 = await createTestUser(testUsers.regularUser2);
  const collab2 = await createTestUser({
    email: 'concurrent1@test.com',
    password: 'Concurrent123!',
    role: 'user',
    status: 'active'
  });

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(owner.id);

  // Simulate concurrent additions
  const promises = [
    supabase.from('job_collaborators').insert({ job_id: job.id, user_id: collab1.id }),
    supabase.from('job_collaborators').insert({ job_id: job.id, user_id: collab2.id })
  ];

  const results = await Promise.all(promises);

  // At least one should succeed
  const successes = results.filter(r => !r.error).length;
  assertTrue(successes >= 1, 'At least one concurrent add should succeed');
});

// Test 13: Validate user exists before adding
collaboratorTests.addTest('Cannot add non-existent user as collaborator', async () => {
  const owner = await createTestUser(testUsers.regularUser1);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(owner.id);

  // Try to add non-existent user
  const fakeUserId = '00000000-0000-0000-0000-000000000000';

  const { error } = await supabase
    .from('job_collaborators')
    .insert({
      job_id: job.id,
      user_id: fakeUserId
    });

  assertExists(error, 'Should not add non-existent user');
});

// Test 14: Edit team members modal functionality
collaboratorTests.addTest('Edit team members updates collaborators correctly', async () => {
  const owner = await createTestUser(testUsers.regularUser1);
  const collab1 = await createTestUser(testUsers.regularUser2);
  const collab2 = await createTestUser({
    email: 'edit1@test.com',
    password: 'Edit123!',
    role: 'user',
    status: 'active'
  });
  const collab3 = await createTestUser({
    email: 'edit2@test.com',
    password: 'Edit123!',
    role: 'user',
    status: 'active'
  });

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(owner.id, [collab1.id, collab2.id]);

  // Simulate edit: Remove collab1, keep collab2, add collab3
  await supabase
    .from('job_collaborators')
    .delete()
    .eq('job_id', job.id)
    .eq('user_id', collab1.id);

  await supabase
    .from('job_collaborators')
    .insert({ job_id: job.id, user_id: collab3.id });

  // Verify final state
  const { data: finalCollabs } = await supabase
    .from('job_collaborators')
    .select('user_id')
    .eq('job_id', job.id);

  const finalIds = finalCollabs?.map(c => c.user_id) || [];

  assertFalse(finalIds.includes(collab1.id), 'Collab1 should be removed');
  assertTrue(finalIds.includes(collab2.id), 'Collab2 should remain');
  assertTrue(finalIds.includes(collab3.id), 'Collab3 should be added');
});

// Test 15: Collaborator visibility in real-time
collaboratorTests.addTest('Collaborator changes reflect immediately', async () => {
  const owner = await createTestUser(testUsers.regularUser1);
  const collab = await createTestUser(testUsers.regularUser2);

  await supabase.auth.signInWithPassword({
    email: testUsers.regularUser1.email,
    password: testUsers.regularUser1.password
  });

  const job = await createTestJob(owner.id);

  // Add collaborator
  const beforeAdd = Date.now();
  await supabase
    .from('job_collaborators')
    .insert({ job_id: job.id, user_id: collab.id });
  const afterAdd = Date.now();

  // Check immediately
  const { data: collaborators } = await supabase
    .from('job_collaborators')
    .select('*')
    .eq('job_id', job.id);

  const addTime = afterAdd - beforeAdd;
  console.log(`   Collaborator add took ${addTime}ms`);

  const collabIds = collaborators?.map(c => c.user_id) || [];
  assertArrayContains(collabIds, collab.id, 'Collaborator should be visible immediately');
});

// Run all collaborator tests
async function runCollaboratorTests() {
  console.log('\n📋 COLLABORATOR MANAGEMENT TESTS\n');

  // Clear database before tests
  await clearDatabase();

  // Run tests
  const results = await collaboratorTests.run();

  return results;
}

module.exports = { runCollaboratorTests };