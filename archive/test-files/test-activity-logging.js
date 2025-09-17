const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://drwytmbsonrfbzxpjkzm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testActivityLogging() {
  console.log('Testing activity logging system...\n');

  try {
    // 1. Check if table exists and structure
    console.log('1. Checking activity_logs table...');
    const { data: tableTest, error: tableError } = await supabase
      .from('activity_logs')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('❌ Table error:', tableError);
      return;
    }
    console.log('✅ Table exists and accessible');

    // 2. Test direct log insertion
    console.log('\n2. Testing direct log insertion...');
    const testUserId = 'caec1fa4-f326-42f1-9653-648e5d467c20'; // Your admin user ID

    const { data: directLog, error: directError } = await supabase
      .from('activity_logs')
      .insert({
        user_id: testUserId,
        action: 'test.direct_insertion',
        status: 'success',
        details: {
          test_type: 'direct_insertion',
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (directError) {
      console.error('❌ Direct insertion failed:', directError);
    } else {
      console.log('✅ Direct insertion successful:', directLog.id);
    }

    // 3. Test ActivityLogger class
    console.log('\n3. Testing ActivityLogger class...');

    // Simulate the ActivityLogger.log method
    const testLog = async (userId, action, status = 'success', details = {}) => {
      try {
        const { error } = await supabase
          .from('activity_logs')
          .insert({
            user_id: userId,
            action: action,
            status: status,
            details: details,
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error(`❌ ActivityLogger test failed for ${action}:`, error);
          return false;
        } else {
          console.log(`✅ ActivityLogger test successful for: ${action}`);
          return true;
        }
      } catch (error) {
        console.error(`❌ ActivityLogger exception for ${action}:`, error);
        return false;
      }
    };

    // Test various log types
    await testLog(testUserId, 'user.color_changed', 'success', { new_color_index: 5 });
    await testLog(testUserId, 'user.role_changed', 'success', { new_role: 'admin' });
    await testLog(testUserId, 'job.created', 'success', { venue: 'Test Venue' });

    // 4. Check total logs in database
    console.log('\n4. Checking all logs in database...');
    const { data: allLogs, error: logsError } = await supabase
      .from('activity_logs')
      .select(`
        id,
        user_id,
        action,
        status,
        details,
        created_at,
        users:user_id (
          id,
          email,
          full_name,
          initials
        )
      `)
      .order('created_at', { ascending: false });

    if (logsError) {
      console.error('❌ Error fetching logs:', logsError);
    } else {
      console.log(`📊 Total logs in database: ${allLogs.length}`);

      if (allLogs.length > 0) {
        console.log('\nRecent logs:');
        allLogs.slice(0, 5).forEach((log, index) => {
          console.log(`  ${index + 1}. ${log.created_at} - ${log.action} by ${log.users?.full_name || log.user_id}`);
          if (log.details && Object.keys(log.details).length > 0) {
            console.log(`     Details: ${JSON.stringify(log.details)}`);
          }
        });
      } else {
        console.log('📭 No logs found in database');
      }
    }

    // 5. Test the API endpoint that should create logs
    console.log('\n5. Testing UserService.getActivityLogs()...');

    // Simulate what the frontend calls
    const { data: frontendLogs, error: frontendError } = await supabase
      .from('activity_logs')
      .select(`
        id,
        user_id,
        action,
        status,
        details,
        created_at,
        users:user_id (
          id,
          email,
          full_name,
          initials
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (frontendError) {
      console.error('❌ Frontend query failed:', frontendError);
    } else {
      console.log(`✅ Frontend would see ${frontendLogs.length} logs`);
    }

    // 6. Check RLS policies
    console.log('\n6. Testing RLS policies...');

    // Test with anon key (should fail)
    const anonSupabase = createClient(supabaseUrl, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjEzMjIsImV4cCI6MjA3MzAzNzMyMn0.YLFfJpQijIekgTsS3HAW4Ph4pnUeKIP3TievrX6eFc0');

    const { data: anonData, error: anonError } = await anonSupabase
      .from('activity_logs')
      .select('*')
      .limit(1);

    if (anonError) {
      console.log('✅ RLS working - anon access blocked:', anonError.message);
    } else {
      console.log('⚠️  RLS issue - anon can access logs');
    }

  } catch (error) {
    console.error('❌ Test failed with exception:', error);
  }
}

testActivityLogging().catch(console.error);