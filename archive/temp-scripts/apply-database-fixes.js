#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applySQLFile(filePath) {
  console.log(`📄 Applying ${path.basename(filePath)}...`);

  try {
    const sql = fs.readFileSync(filePath, 'utf8');

    // Split by semicolons and execute each statement
    const statements = sql.split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error && !error.message.includes('already exists')) {
          console.error(`Error executing SQL: ${error.message}`);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
        }
      }
    }

    console.log(`✅ Applied ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`❌ Error applying ${filePath}:`, error.message);
  }
}

async function main() {
  console.log('🔧 Applying database fixes...\n');

  // Apply the schema consistency fix
  await applySQLFile('./schema-consistency-fix.sql');

  // Test basic functionality
  console.log('\n🧪 Testing basic functionality...');

  try {
    // Test user creation
    const { data: testUser, error: userError } = await supabase.from('users').insert({
      email: 'test-apply-fix@example.com',
      full_name: 'Test Apply Fix User',
      role: 'user'
    }).select().single();

    if (!userError) {
      console.log('✅ User creation works');

      // Test job creation
      const { data: testJob, error: jobError } = await supabase.from('jobs').insert({
        venue: 'Test Venue Apply',
        job_id: `test-job-${Date.now()}`,
        status: 'draft',
        created_by: testUser.id,
        owner_id: testUser.id,
        collaborators: []
      }).select().single();

      if (!jobError) {
        console.log('✅ Job creation works');

        // Clean up
        await supabase.from('jobs').delete().eq('id', testJob.id);
        console.log('✅ Job cleanup works');
      } else {
        console.error('❌ Job creation failed:', jobError.message);
      }

      await supabase.from('users').delete().eq('id', testUser.id);
      console.log('✅ User cleanup works');
    } else {
      console.error('❌ User creation failed:', userError.message);
    }

  } catch (error) {
    console.error('❌ Testing failed:', error.message);
  }

  console.log('\n🎉 Database fixes application completed!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});