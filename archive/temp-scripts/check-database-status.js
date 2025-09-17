#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkDatabaseStatus() {
  console.log('🔍 Checking Database Status for Parsley System\n');

  let allGood = true;

  try {
    // Check if owner_id column exists
    console.log('1️⃣ Checking owner_id column in jobs table...');
    const { data: columns, error: colError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'jobs')
      .eq('column_name', 'owner_id')
      .eq('table_schema', 'public');

    if (colError) {
      console.error('❌ Error checking columns:', colError.message);
      allGood = false;
    } else if (columns && columns.length > 0) {
      console.log('✅ owner_id column exists in jobs table');
    } else {
      console.log('❌ owner_id column does NOT exist in jobs table');
      allGood = false;
    }

    // Test get_jobs_for_user RPC function
    console.log('\n2️⃣ Testing get_jobs_for_user RPC function...');
    try {
      // Create a test user first
      const testUserId = 'test-' + Date.now();
      const { data, error } = await supabase.rpc('get_jobs_for_user', {
        user_id: testUserId
      });

      if (error) {
        if (error.message.includes('Could not find the function')) {
          console.log('❌ get_jobs_for_user RPC function does NOT exist');
          allGood = false;
        } else {
          console.log('✅ get_jobs_for_user RPC function exists (returned error as expected for test user)');
        }
      } else {
        console.log('✅ get_jobs_for_user RPC function exists and works');
      }
    } catch (error) {
      console.log('❌ get_jobs_for_user RPC function error:', error.message);
      allGood = false;
    }

    // Test update_user_role RPC function
    console.log('\n3️⃣ Testing update_user_role RPC function...');
    try {
      const { error } = await supabase.rpc('update_user_role', {
        p_user_id: 'test-user',
        p_new_role: 'user',
        p_admin_id: 'test-admin'
      });

      if (error) {
        if (error.message.includes('Could not find the function')) {
          console.log('❌ update_user_role RPC function does NOT exist');
          allGood = false;
        } else {
          console.log('✅ update_user_role RPC function exists (returned error as expected for test data)');
        }
      } else {
        console.log('✅ update_user_role RPC function exists');
      }
    } catch (error) {
      console.log('❌ update_user_role RPC function error:', error.message);
      allGood = false;
    }

    // Test transfer_job_ownership RPC function
    console.log('\n4️⃣ Testing transfer_job_ownership RPC function...');
    try {
      const { error } = await supabase.rpc('transfer_job_ownership', {
        p_job_id: 'test-job',
        p_new_owner_id: 'test-owner',
        p_current_user_id: 'test-user'
      });

      if (error) {
        if (error.message.includes('Could not find the function')) {
          console.log('❌ transfer_job_ownership RPC function does NOT exist');
          allGood = false;
        } else {
          console.log('✅ transfer_job_ownership RPC function exists (returned error as expected for test data)');
        }
      } else {
        console.log('✅ transfer_job_ownership RPC function exists');
      }
    } catch (error) {
      console.log('❌ transfer_job_ownership RPC function error:', error.message);
      allGood = false;
    }

    // Test basic user and job creation
    console.log('\n5️⃣ Testing basic database operations...');

    // Test user creation
    const testUserData = {
      id: crypto.randomUUID(),
      email: `test-status-${Date.now()}@example.com`,
      full_name: 'Database Status Test User',
      role: 'user'
    };

    const { data: testUser, error: userError } = await supabase
      .from('users')
      .insert(testUserData)
      .select()
      .single();

    if (userError) {
      console.log('❌ User creation failed:', userError.message);
      allGood = false;
    } else {
      console.log('✅ User creation works');

      // Test job creation if user creation succeeded
      const jobData = {
        venue: 'Database Status Test Venue',
        job_id: `test-status-${Date.now()}`,
        status: 'draft',
        created_by: testUser.id,
        collaborators: []
      };

      // Add owner_id if column exists
      if (columns && columns.length > 0) {
        jobData.owner_id = testUser.id;
      }

      const { data: testJob, error: jobError } = await supabase
        .from('jobs')
        .insert(jobData)
        .select()
        .single();

      if (jobError) {
        console.log('❌ Job creation failed:', jobError.message);
        allGood = false;
      } else {
        console.log('✅ Job creation works');

        // Cleanup
        await supabase.from('jobs').delete().eq('id', testJob.id);
      }

      // Cleanup user
      await supabase.from('users').delete().eq('id', testUser.id);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    allGood = false;
  }

  console.log('\n' + '='.repeat(60));

  if (allGood) {
    console.log('🎉 DATABASE STATUS: ALL GOOD!');
    console.log('✅ All required components are properly set up');
    console.log('✅ The system should be fully functional');
    console.log('\n📋 Ready to use:');
    console.log('   • npm run dev - Start the development server');
    console.log('   • npm run test:database - Run database tests');
    console.log('   • Test job ownership transfer in the UI');
  } else {
    console.log('⚠️  DATABASE STATUS: NEEDS FIXES');
    console.log('\n📋 Required actions:');
    console.log('   1. Open Supabase Dashboard → SQL Editor');
    console.log('   2. Copy and paste the SQL from APPLY-THESE-DATABASE-FIXES.sql');
    console.log('   3. Run the SQL script');
    console.log('   4. Re-run this check: node check-database-status.js');
    console.log('\nSQL file location: ./APPLY-THESE-DATABASE-FIXES.sql');
  }
}

// Add crypto polyfill for older Node.js versions
if (typeof crypto === 'undefined') {
  global.crypto = require('crypto');
}

checkDatabaseStatus().catch(error => {
  console.error('💥 Fatal error:', error.message);
  process.exit(1);
});