const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim();
    }
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
  const { data: logs, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Recent activity logs:\n');
  logs.forEach(log => {
    const time = new Date(log.created_at).toLocaleString();
    console.log(`[${time}] ${log.action}`);
    console.log(`  Description: ${log.description || '(MISSING)'}`);
    if (log.details?.job_number) {
      console.log(`  Job: ${log.details.job_number}`);
    }
    console.log('');
  });

  // Check if any recent logs are missing descriptions
  const missingDesc = logs.filter(l => !l.description && !l.action.includes('test'));
  if (missingDesc.length > 0) {
    console.log(`\n⚠️  ${missingDesc.length} recent logs are missing descriptions`);
    console.log('These actions:', missingDesc.map(l => l.action).join(', '));
  }
}

checkLogs();