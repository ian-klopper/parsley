const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyAuthFix() {
  console.log('🔧 Applying auth trigger fix...');

  try {
    // Read the SQL file
    const sql = fs.readFileSync('fix-auth-trigger.sql', 'utf8');

    // Split into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n${i + 1}. Executing: ${statement.substring(0, 60)}...`);

      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        });

        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          console.error(`Statement: ${statement}`);
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`❌ Exception in statement ${i + 1}:`, err);
        console.error(`Statement: ${statement}`);
      }
    }

    console.log('\n🎉 Auth trigger fix application complete!');
    console.log('Now try signing in with Google again.');

  } catch (error) {
    console.error('❌ Failed to apply auth fix:', error);
  }
}

applyAuthFix();