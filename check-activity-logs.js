require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkActivityLogs() {
  try {
    const jobId = '635214c5-9b7a-4cf5-918f-b67e64b34af1';

    console.log('🔍 Checking recent activity logs for extraction...\n');

    const { data: logs, error } = await supabase
      .from('activity_logs')
      .select('*')
      .ilike('description', '%extraction%')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching logs:', error);
      return;
    }

    logs.forEach((log, index) => {
      console.log(`📋 Log ${index + 1}:`);
      console.log(`   Action: ${log.action}`);
      console.log(`   Time: ${log.created_at}`);
      console.log(`   Description: ${log.description}`);
      if (log.metadata) {
        console.log(`   Metadata:`, JSON.stringify(log.metadata, null, 2));
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

checkActivityLogs();