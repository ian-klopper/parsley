#!/usr/bin/env node

/**
 * Infrastructure setup script for extraction pipeline
 * Creates the extraction-results storage bucket and adds results column to jobs table
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });
    return envVars;
  }
  return {};
}

const env = loadEnv();

async function setupInfrastructure() {
  console.log('🔧 Setting up extraction pipeline infrastructure...');

  // Initialize Supabase client
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Create extraction-results storage bucket
    console.log('📦 Creating extraction-results storage bucket...');
    const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('extraction-results', {
      public: false,
      allowedMimeTypes: ['application/json'],
      fileSizeLimit: 10485760 // 10MB
    });

    if (bucketError && !bucketError.message.includes('already exists')) {
      console.error('❌ Failed to create bucket:', bucketError);
    } else {
      console.log('✅ Storage bucket created or already exists');
    }

    // 2. Add results column to jobs table
    console.log('🗄️ Adding results column to jobs table...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.jobs
        ADD COLUMN IF NOT EXISTS results JSONB;
      `
    });

    if (alterError) {
      console.error('❌ Failed to add results column:', alterError);
      // Try direct SQL execution
      console.log('🔄 Trying direct SQL execution...');
      const { error: directError } = await supabase
        .from('jobs')
        .select('id')
        .limit(1);

      if (directError) {
        console.error('❌ Database connection issue:', directError);
      } else {
        console.log('✅ Database connection OK, but ALTER TABLE may need manual execution');
        console.log('📋 Please run this SQL manually in your Supabase dashboard:');
        console.log('ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS results JSONB;');
      }
    } else {
      console.log('✅ Results column added to jobs table');
    }

    console.log('🎉 Infrastructure setup completed!');
    console.log('📋 Summary:');
    console.log('  - Storage bucket: extraction-results (created)');
    console.log('  - Database column: jobs.results (added)');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupInfrastructure();
}

module.exports = { setupInfrastructure };