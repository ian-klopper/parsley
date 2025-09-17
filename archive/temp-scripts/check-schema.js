const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  try {
    // Check users table structure
    console.log('=== USERS TABLE SCHEMA ===');
    const { data: usersSchema, error: usersError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = 'users' AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });

    if (usersError) {
      console.error('Users schema error:', usersError);
    } else {
      console.log(JSON.stringify(usersSchema, null, 2));
    }

    // Check jobs table structure
    console.log('\n=== JOBS TABLE SCHEMA ===');
    const { data: jobsSchema, error: jobsError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = 'jobs' AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });

    if (jobsError) {
      console.error('Jobs schema error:', jobsError);
    } else {
      console.log(JSON.stringify(jobsSchema, null, 2));
    }

    // Check existing tables
    console.log('\n=== ALL PUBLIC TABLES ===');
    const { data: tables, error: tablesError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name;
        `
      });

    if (tablesError) {
      console.error('Tables error:', tablesError);
    } else {
      console.log(JSON.stringify(tables, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema();