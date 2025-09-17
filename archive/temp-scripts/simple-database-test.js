#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('🧪 Simple Database Test\n');

  let testUserId = null;
  let testJobId = null;

  try {
    // Test 1: Create user
    console.log('1️⃣ Testing user creation...');
    const userData = {
      id: uuidv4(),
      email: `test-simple-${uuidv4()}@example.com`,
      full_name: 'Simple Test User',
      role: 'user'
    };

    const { data: user, error: userError } = await supabase.from('users').insert(userData).select().single();

    if (userError) {
      console.error('❌ User creation failed:', userError);
      return;
    }

    testUserId = user.id;
    console.log('✅ User created successfully');
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Initials: ${user.initials || 'NOT SET'}`);
    console.log(`   - Color: ${user.color_index ?? 'NOT SET'}`);

    // Test 2: Create job
    console.log('\n2️⃣ Testing job creation...');

    // First check if owner_id column exists
    const { data: columns } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'jobs')
      .eq('table_schema', 'public');

    const hasOwnerIdColumn = columns?.some(col => col.column_name === 'owner_id');
    console.log(`   - owner_id column exists: ${hasOwnerIdColumn}`);

    const jobData = {
      venue: 'Simple Test Venue',
      job_id: `simple-test-${Date.now()}`,
      status: 'draft',
      created_by: testUserId,
      collaborators: []
    };

    // Add owner_id if the column exists
    if (hasOwnerIdColumn) {
      jobData.owner_id = testUserId;
    }

    const { data: job, error: jobError } = await supabase.from('jobs').insert(jobData).select().single();

    if (jobError) {
      console.error('❌ Job creation failed:', jobError);
    } else {
      testJobId = job.id;
      console.log('✅ Job created successfully');
      console.log(`   - ID: ${job.id}`);
      console.log(`   - Venue: ${job.venue}`);
      console.log(`   - Created by: ${job.created_by}`);
      console.log(`   - Owner ID: ${job.owner_id || 'NOT SET'}`);
    }

    // Test 3: Test RPC functions
    console.log('\n3️⃣ Testing RPC functions...');

    const { data: rpcJobs, error: rpcError } = await supabase.rpc('get_jobs_for_user', {
      user_id: testUserId
    });

    if (rpcError) {
      console.error('❌ get_jobs_for_user RPC failed:', rpcError);
    } else {
      console.log('✅ get_jobs_for_user RPC works');
      console.log(`   - Returned ${rpcJobs?.length || 0} jobs`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    if (testJobId) {
      await supabase.from('jobs').delete().eq('id', testJobId);
      console.log('- Deleted test job');
    }
    if (testUserId) {
      await supabase.from('users').delete().eq('id', testUserId);
      console.log('- Deleted test user');
    }
  }

  console.log('\n✅ Simple test completed');
}

main();