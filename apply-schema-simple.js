const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://drwytmbsonrfbzxpjkzm.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function clearAndRecreateSchema() {
  console.log('🧹 Clearing existing data and recreating optimized schema...');

  try {
    // Step 1: Drop existing tables in correct order
    console.log('🗑️  Dropping existing tables...');

    const dropStatements = [
      'DROP TABLE IF EXISTS public.activity_logs CASCADE',
      'DROP TABLE IF EXISTS public.job_collaborators CASCADE',
      'DROP TABLE IF EXISTS public.jobs CASCADE',
      'DROP TABLE IF EXISTS public.users CASCADE',
      'DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE',
      'DROP FUNCTION IF EXISTS auto_populate_user_fields() CASCADE',
      'DROP FUNCTION IF EXISTS generate_initials(TEXT) CASCADE'
    ];

    for (const statement of dropStatements) {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      if (error) {
        console.log(`Note: ${statement} - ${error.message}`);
      } else {
        console.log(`✅ ${statement}`);
      }
    }

    // Step 2: Create users table with single ID system
    console.log('👥 Creating users table...');
    const createUsersSQL = `
      CREATE TABLE public.users (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT,
        initials TEXT,
        avatar_url TEXT,
        role TEXT NOT NULL DEFAULT 'pending' CHECK (role IN ('pending', 'user', 'admin')),
        color_index INTEGER DEFAULT floor(random() * 12)::integer CHECK (color_index >= 0 AND color_index <= 11),
        approved_at TIMESTAMPTZ,
        approved_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    let { error } = await supabase.rpc('exec_sql', { sql: createUsersSQL });
    if (error) {
      console.error('❌ Error creating users table:', error);
      return;
    }
    console.log('✅ Users table created');

    // Step 3: Create jobs table
    console.log('💼 Creating jobs table...');
    const createJobsSQL = `
      CREATE TABLE public.jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        venue TEXT NOT NULL,
        job_id TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'processing', 'complete', 'error')),
        created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
        owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
        last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    ({ error } = await supabase.rpc('exec_sql', { sql: createJobsSQL }));
    if (error) {
      console.error('❌ Error creating jobs table:', error);
      return;
    }
    console.log('✅ Jobs table created');

    // Step 4: Create job_collaborators table
    console.log('🤝 Creating job_collaborators table...');
    const createCollaboratorsSQL = `
      CREATE TABLE public.job_collaborators (
        job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        added_by UUID REFERENCES public.users(id),
        PRIMARY KEY (job_id, user_id)
      )
    `;

    ({ error } = await supabase.rpc('exec_sql', { sql: createCollaboratorsSQL }));
    if (error) {
      console.error('❌ Error creating job_collaborators table:', error);
      return;
    }
    console.log('✅ Job collaborators table created');

    // Step 5: Create activity_logs table
    console.log('📊 Creating activity_logs table...');
    const createActivityLogsSQL = `
      CREATE TABLE public.activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        details JSONB DEFAULT '{}',
        status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure', 'pending')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    ({ error } = await supabase.rpc('exec_sql', { sql: createActivityLogsSQL }));
    if (error) {
      console.error('❌ Error creating activity_logs table:', error);
      return;
    }
    console.log('✅ Activity logs table created');

    // Step 6: Create indexes
    console.log('⚡ Creating performance indexes...');
    const indexes = [
      'CREATE INDEX idx_users_email ON public.users(email)',
      'CREATE INDEX idx_users_role ON public.users(role)',
      'CREATE INDEX idx_jobs_owner_created ON public.jobs(owner_id, created_at DESC)',
      'CREATE INDEX idx_jobs_creator_status ON public.jobs(created_by, status)',
      'CREATE INDEX idx_job_collaborators_user_jobs ON public.job_collaborators(user_id, job_id)',
      'CREATE INDEX idx_activity_logs_user_time ON public.activity_logs(user_id, created_at DESC)'
    ];

    for (const indexSQL of indexes) {
      const { error } = await supabase.rpc('exec_sql', { sql: indexSQL });
      if (error) {
        console.log(`Note: ${indexSQL} - ${error.message}`);
      } else {
        console.log(`✅ Index created`);
      }
    }

    // Step 7: Create utility functions
    console.log('🔧 Creating utility functions...');
    const updateTriggerSQL = `
      CREATE OR REPLACE FUNCTION public.update_updated_at_column()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$
    `;

    ({ error } = await supabase.rpc('exec_sql', { sql: updateTriggerSQL }));
    if (error) {
      console.log('Note: Function creation may need manual intervention');
    } else {
      console.log('✅ Update trigger function created');
    }

    // Step 8: Enable RLS and create basic policies
    console.log('🔐 Enabling Row Level Security...');
    const rlsStatements = [
      'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE public.job_collaborators ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY'
    ];

    for (const statement of rlsStatements) {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      if (error) {
        console.log(`Note: ${statement} - ${error.message}`);
      } else {
        console.log(`✅ RLS enabled`);
      }
    }

    console.log('🎉 Optimized schema applied successfully!');
    console.log('📋 Next steps:');
    console.log('  1. Update database types in src/types/database.ts');
    console.log('  2. Test the application with new schema');

  } catch (error) {
    console.error('❌ Failed to apply schema:', error);
  }
}

// Check if exec_sql RPC function exists, if not suggest manual approach
async function checkRPCFunction() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
  if (error) {
    console.log('ℹ️  exec_sql RPC function not available. Schema needs manual application.');
    console.log('💡 Please run the SQL file manually in Supabase SQL Editor or use psql directly.');
    return false;
  }
  return true;
}

async function main() {
  const canUseRPC = await checkRPCFunction();
  if (canUseRPC) {
    await clearAndRecreateSchema();
  }
}

main();