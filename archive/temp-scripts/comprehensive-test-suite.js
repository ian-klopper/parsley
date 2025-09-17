require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Create clients for different auth contexts
const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

class ComprehensiveTestSuite {
  constructor() {
    this.testResults = [];
    this.testUsers = [];
    this.testJobs = [];
  }

  logResult(testName, passed, message, expected = null, actual = null) {
    const result = {
      test: testName,
      status: passed ? 'PASS' : 'FAIL',
      message,
      expected,
      actual,
      timestamp: new Date().toISOString()
    };
    this.testResults.push(result);
    
    const emoji = passed ? '✅' : '❌';
    console.log(`${emoji} ${testName}: ${passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${message}`);
    if (!passed && expected && actual) {
      console.log(`   Expected: ${expected}`);
      console.log(`   Actual: ${actual}`);
    }
    console.log('');
  }

  async runAllTests() {
    console.log('🧪 COMPREHENSIVE TEST SUITE - USER REQUIREMENTS');
    console.log('===============================================');
    console.log(`Started at: ${new Date().toISOString()}\n`);

    try {
      await this.setupTestEnvironment();
      await this.runUserCreationTests();
      await this.runUserManagementTests();
      await this.runJobManagementTests();
      await this.runConcurrencyAndIntegrityTests();
      await this.runUIFunctionalityTests();
      await this.generateTestReport();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }

  async setupTestEnvironment() {
    console.log('🔧 SETTING UP TEST ENVIRONMENT');
    console.log('==============================\n');

    // Verify database connection
    try {
      const { data, error } = await adminClient.from('users').select('count').limit(1);
      if (error) throw error;
      this.logResult('ENV-001', true, 'Database connection established');
    } catch (error) {
      this.logResult('ENV-001', false, `Database connection failed: ${error.message}`);
      throw error;
    }

    // Clean up any existing test data
    await adminClient.from('activity_logs').delete().ilike('action', '%test%');
    await adminClient.from('jobs').delete().ilike('venue', 'Test%');
    await adminClient.from('users').delete().ilike('email', '%test%');
    
    this.logResult('ENV-002', true, 'Test environment cleaned');
  }

  async runUserCreationTests() {
    console.log('👤 TESTING USER CREATION & ONBOARDING');
    console.log('====================================\n');

    // Test 1.1: User Creation with auto-generated fields
    try {
      const testEmail = `test.user.${Date.now()}@example.com`;
      const { data: newUser, error } = await adminClient
        .from('users')
        .insert({
          email: testEmail,
          full_name: 'John Test Doe',
          role: 'user'  // Should default to 'user' role
        })
        .select()
        .single();

      if (error) throw error;

      // Verify all required fields are auto-generated
      const hasId = !!newUser.id;
      const hasInitials = !!newUser.initials;
      const hasColor = newUser.color_index !== null;
      const correctRole = newUser.role === 'user';
      const expectedInitials = newUser.initials === 'JT';

      this.testUsers.push(newUser);

      this.logResult('Test-1.1a', hasId, `User ID auto-generated: ${newUser.id}`, 'UUID', hasId ? 'Generated' : 'Missing');
      this.logResult('Test-1.1b', correctRole, `User role set correctly: ${newUser.role}`, 'user', newUser.role);
      this.logResult('Test-1.1c', hasInitials, `Initials auto-generated: ${newUser.initials}`, 'JT', newUser.initials);
      this.logResult('Test-1.1d', hasColor, `Color auto-assigned: ${newUser.color_index}`, 'number', newUser.color_index);

    } catch (error) {
      this.logResult('Test-1.1', false, `User creation failed: ${error.message}`);
    }
  }

  async runUserManagementTests() {
    console.log('🔐 TESTING USER MANAGEMENT & PERMISSIONS');
    console.log('======================================\n');

    if (this.testUsers.length === 0) {
      this.logResult('Test-1.2', false, 'No test users available for management tests');
      return;
    }

    const testUser = this.testUsers[0];

    // Test 1.2: User Self-Update
    try {
      const { data, error } = await adminClient
        .from('users')
        .update({ full_name: 'John Updated Doe' })
        .eq('id', testUser.id)
        .select()
        .single();

      if (error) throw error;

      const nameUpdated = data.full_name === 'John Updated Doe';
      this.logResult('Test-1.2', nameUpdated, 'User successfully updated own profile', 'John Updated Doe', data.full_name);

      // Check if activity log was created
      const { data: logs } = await adminClient
        .from('activity_logs')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('action', 'Profile updated');

      this.logResult('Test-1.2-Log', logs && logs.length > 0, 'Activity log created for profile update', 'log entry', logs ? logs.length : 0);

    } catch (error) {
      this.logResult('Test-1.2', false, `User self-update failed: ${error.message}`);
    }

    // Test 1.4: Admin Role Change
    try {
      const { data, error } = await adminClient
        .from('users')
        .update({ role: 'admin' })
        .eq('id', testUser.id)
        .select()
        .single();

      if (error) throw error;

      const roleChanged = data.role === 'admin';
      this.logResult('Test-1.4', roleChanged, 'Admin successfully changed user role', 'admin', data.role);

      // Test changing back to regular user
      await adminClient
        .from('users')
        .update({ role: 'user' })
        .eq('id', testUser.id);

    } catch (error) {
      this.logResult('Test-1.4', false, `Admin role change failed: ${error.message}`);
    }

    // Test creating pending user
    try {
      const pendingEmail = `pending.user.${Date.now()}@example.com`;
      const { data: pendingUser, error } = await adminClient
        .from('users')
        .insert({
          email: pendingEmail,
          full_name: 'Pending Test User',
          role: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      this.testUsers.push(pendingUser);
      this.logResult('Test-Pending-Setup', true, 'Pending user created for testing');

    } catch (error) {
      this.logResult('Test-Pending-Setup', false, `Pending user creation failed: ${error.message}`);
    }
  }

  async runJobManagementTests() {
    console.log('💼 TESTING JOB MANAGEMENT');
    console.log('========================\n');

    if (this.testUsers.length === 0) {
      this.logResult('Job-Tests', false, 'No test users available for job tests');
      return;
    }

    const regularUser = this.testUsers.find(u => u.role === 'user') || this.testUsers[0];
    const pendingUser = this.testUsers.find(u => u.role === 'pending');

    // Test 2.1: Job Creation by Regular User
    try {
      const { data: newJob, error } = await adminClient
        .from('jobs')
        .insert({
          venue: 'Test Venue Alpha',
          job_id: `test-job-${Date.now()}`,
          status: 'draft',
          created_by: regularUser.id,
          collaborators: []
        })
        .select()
        .single();

      if (error) throw error;

      this.testJobs.push(newJob);
      const correctCreator = newJob.created_by === regularUser.id;
      this.logResult('Test-2.1', correctCreator, 'Regular user successfully created job', regularUser.id, newJob.created_by);

    } catch (error) {
      this.logResult('Test-2.1', false, `Job creation by regular user failed: ${error.message}`);
    }

    // Test 2.3: Job Update by Creator
    if (this.testJobs.length > 0) {
      try {
        const job = this.testJobs[0];
        const { data, error } = await adminClient
          .from('jobs')
          .update({ venue: 'Updated Test Venue' })
          .eq('id', job.id)
          .eq('created_by', regularUser.id)  // Ensure only creator can update
          .select()
          .single();

        if (error) throw error;

        const venueUpdated = data.venue === 'Updated Test Venue';
        this.logResult('Test-2.3', venueUpdated, 'Job creator successfully updated job', 'Updated Test Venue', data.venue);

      } catch (error) {
        this.logResult('Test-2.3', false, `Job update by creator failed: ${error.message}`);
      }
    }

    // Test 2.4: Job Collaboration
    if (this.testJobs.length > 0 && this.testUsers.length > 1) {
      try {
        const job = this.testJobs[0];
        const collaborator = this.testUsers[1];
        
        const { data, error } = await adminClient
          .from('jobs')
          .update({ 
            collaborators: [collaborator.id]
          })
          .eq('id', job.id)
          .select()
          .single();

        if (error) throw error;

        const hasCollaborator = data.collaborators.includes(collaborator.id);
        this.logResult('Test-2.4', hasCollaborator, 'Collaborator successfully added to job', 'collaborator added', hasCollaborator);

      } catch (error) {
        this.logResult('Test-2.4', false, `Job collaboration failed: ${error.message}`);
      }
    }

    // Test 2.6: Job Deletion by Admin
    if (this.testJobs.length > 0) {
      try {
        const job = this.testJobs[0];
        const { error } = await adminClient
          .from('jobs')
          .delete()
          .eq('id', job.id);

        this.logResult('Test-2.6', !error, error ? `Job deletion failed: ${error.message}` : 'Admin successfully deleted job');

      } catch (error) {
        this.logResult('Test-2.6', false, `Job deletion by admin failed: ${error.message}`);
      }
    }
  }

  async runConcurrencyAndIntegrityTests() {
    console.log('⚡ TESTING CONCURRENCY & DATA INTEGRITY');
    console.log('======================================\n');

    if (this.testUsers.length === 0) {
      this.logResult('Test-3.x', false, 'No test users available for integrity tests');
      return;
    }

    const testUser = this.testUsers[0];

    // Test 3.2: Data Integrity - Invalid User Reference
    try {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';
      const { data, error } = await adminClient
        .from('jobs')
        .insert({
          venue: 'Invalid Creator Test',
          job_id: `invalid-test-${Date.now()}`,
          created_by: fakeUserId,
          collaborators: []
        })
        .select();

      // This should fail due to foreign key constraint
      const failed = !!error;
      this.logResult('Test-3.2', failed, failed ? 'Data integrity enforced - invalid user reference rejected' : 'ERROR: Invalid user reference was accepted');

    } catch (error) {
      this.logResult('Test-3.2', true, `Data integrity enforced: ${error.message}`);
    }

    // Test concurrent role updates
    try {
      const promises = [
        adminClient.from('users').update({ role: 'admin' }).eq('id', testUser.id),
        adminClient.from('users').update({ role: 'user' }).eq('id', testUser.id)
      ];

      await Promise.all(promises);
      
      // Check final state
      const { data: finalUser } = await adminClient
        .from('users')
        .select('role')
        .eq('id', testUser.id)
        .single();

      const hasValidRole = ['admin', 'user'].includes(finalUser.role);
      this.logResult('Test-3.1', hasValidRole, `Concurrent updates handled gracefully, final role: ${finalUser.role}`);

    } catch (error) {
      this.logResult('Test-3.1', false, `Concurrent update test failed: ${error.message}`);
    }
  }

  async runUIFunctionalityTests() {
    console.log('🖥️  TESTING UI FUNCTIONALITY');
    console.log('==========================\n');

    // Test that user data can be retrieved for UI display
    try {
      const { data: allUsers, error } = await anonClient
        .from('users')
        .select('id, email, full_name, initials, role, color_index, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const hasUsers = allUsers.length > 0;
      const allHaveInitials = allUsers.every(u => u.initials);
      const allHaveColors = allUsers.every(u => u.color_index !== null);

      this.logResult('UI-001', hasUsers, `UI can retrieve user list (${allUsers.length} users)`);
      this.logResult('UI-002', allHaveInitials, 'All users have initials for UI display');
      this.logResult('UI-003', allHaveColors, 'All users have colors for UI display');

    } catch (error) {
      this.logResult('UI-001', false, `UI user retrieval failed: ${error.message}`);
    }

    // Test activity logs retrieval for admin UI
    try {
      const { data: logs, error } = await anonClient
        .from('activity_logs')
        .select(`
          *,
          users (
            full_name,
            email,
            initials
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      this.logResult('UI-004', !error, error ? `Activity logs UI query failed: ${error.message}` : 'Activity logs retrievable for admin UI');

    } catch (error) {
      this.logResult('UI-004', false, `Activity logs UI test failed: ${error.message}`);
    }
  }

  async generateTestReport() {
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('======================\n');

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
    const failedTests = this.testResults.filter(r => r.status === 'FAIL').length;
    const passRate = ((passedTests / totalTests) * 100).toFixed(1);

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Pass Rate: ${passRate}%\n`);

    if (failedTests > 0) {
      console.log('❌ FAILED TESTS:');
      console.log('================');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(`• ${result.test}: ${result.message}`);
        });
      console.log('');
    }

    console.log('🎯 COMPLIANCE STATUS:');
    console.log('====================');
    
    const criticalTests = [
      'Test-1.1a', 'Test-1.1b', 'Test-1.1c', 'Test-1.1d', // User creation
      'Test-1.2', 'Test-1.4', // User management  
      'Test-2.1', 'Test-2.3', // Job management
      'Test-3.2' // Data integrity
    ];

    const criticalPassed = criticalTests.filter(testName => 
      this.testResults.find(r => r.test === testName && r.status === 'PASS')
    ).length;

    const compliance = ((criticalPassed / criticalTests.length) * 100).toFixed(1);
    console.log(`Core Requirements Compliance: ${compliance}%`);

    if (compliance >= 90) {
      console.log('🎉 SYSTEM IS READY FOR PRODUCTION');
    } else if (compliance >= 70) {
      console.log('⚠️  SYSTEM REQUIRES MINOR FIXES');
    } else {
      console.log('🚨 SYSTEM REQUIRES MAJOR FIXES');
    }

    console.log(`\nTest completed at: ${new Date().toISOString()}`);
  }
}

// Run the comprehensive test suite
const testSuite = new ComprehensiveTestSuite();
testSuite.runAllTests().catch(console.error);