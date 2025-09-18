const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://drwytmbsonrfbzxpjkzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjEzMjIsImV4cCI6MjA3MzAzNzMyMn0.YLFfJpQijIekgTsS3HAW4Ph4pnUeKIP3TievrX6eFc0';

// Test with anon key to simulate browser client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testJobDocumentsAccess() {
  console.log('🧪 Testing job_documents access with different scenarios...\n');

  // Test 1: Unauthenticated access (should fail)
  console.log('1️⃣ Testing unauthenticated access...');
  try {
    const { data, error } = await supabase
      .from('job_documents')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('   ❌ Unauthenticated access blocked (as expected):', error.message);
    } else {
      console.log('   ⚠️  Unauthenticated access allowed (unexpected):', data);
    }
  } catch (err) {
    console.log('   ❌ Error (expected):', err.message);
  }

  // Test 2: Check if RLS is properly enabled
  console.log('\n2️⃣ Checking RLS status...');
  const serviceSupabase = createClient(supabaseUrl, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao');
  
  try {
    const { data: rlsCheck, error: rlsError } = await serviceSupabase.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          tablename,
          rowsecurity as rls_enabled,
          (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_documents') as policy_count
        FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'job_documents';
      `
    });

    if (rlsError) {
      console.log('   ❌ RLS check failed:', rlsError.message);
    } else {
      console.log('   ✅ RLS status:', rlsCheck?.[0]);
    }
  } catch (err) {
    console.log('   ❌ RLS check error:', err.message);
  }

  // Test 3: Check policies exist
  console.log('\n3️⃣ Checking RLS policies...');
  try {
    const { data: policies, error: policyError } = await serviceSupabase.rpc('exec_sql', {
      sql: `
        SELECT policyname, cmd, roles 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'job_documents'
        ORDER BY policyname;
      `
    });

    if (policyError) {
      console.log('   ❌ Policy check failed:', policyError.message);
    } else {
      console.log('   ✅ Active policies:');
      policies?.forEach(policy => {
        console.log(`     - ${policy.policyname} (${policy.cmd})`);
      });
    }
  } catch (err) {
    console.log('   ❌ Policy check error:', err.message);
  }

  console.log('\n🎉 RLS test complete!');
  console.log('\n📝 Summary:');
  console.log('   - RLS should be enabled on job_documents table');
  console.log('   - 4 policies should exist (select, insert, update, delete)');
  console.log('   - Unauthenticated access should be blocked');
  console.log('   - Users should only see documents for jobs they have access to');
}

testJobDocumentsAccess();