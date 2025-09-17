require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testAutomaticFields() {
  console.log('🧪 TEST: Automatic Field Generation');
  console.log('=====================================');
  
  // Test 1: Fix admin user initials
  console.log('\n1. Fixing Admin User Initials...');
  const { error: updateError } = await supabase
    .from('users')
    .update({ 
      initials: 'IK',
      updated_at: new Date().toISOString()
    })
    .eq('id', '70ba730a-d711-42ce-8eb0-19a5be20df7c');
    
  if (updateError) {
    console.log('❌ FAILED -', updateError.message);
  } else {
    console.log('✅ SUCCESS - Admin initials updated');
  }
  
  // Test 2: Create test user to check auto-generation
  console.log('\n2. Creating Test User...');
  const testEmail = 'testuser' + Date.now() + '@example.com';
  
  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert({
      email: testEmail,
      full_name: 'Jane Smith',
      role: 'user'
    })
    .select()
    .single();
    
  if (createError) {
    console.log('❌ User creation FAILED -', createError.message);
  } else {
    console.log('✅ User creation SUCCESS');
    console.log('   Email:', newUser.email);
    console.log('   Name:', newUser.full_name);
    console.log('   Initials:', newUser.initials || 'NULL');
    console.log('   Role:', newUser.role);
    console.log('   Color Index:', newUser.color_index || 'NULL');
    
    // Check if auto-generation worked
    if (!newUser.initials) {
      console.log('⚠️  Initials NOT auto-generated - need to fix this');
    }
    if (newUser.color_index === null) {
      console.log('⚠️  Color NOT auto-assigned - need to fix this');
    }
  }
  
  // Test 3: Verify all current users
  console.log('\n3. All Users Current State...');
  const { data: allUsers, error: usersError } = await supabase
    .from('users')
    .select('email, full_name, initials, role, color_index, created_at')
    .order('created_at', { ascending: false });
    
  if (usersError) {
    console.log('❌ Failed to get users -', usersError.message);
  } else {
    allUsers.forEach((user, index) => {
      const hasInitials = user.initials ? '✅' : '❌';
      const hasColor = (user.color_index !== null) ? '✅' : '❌';
      
      console.log(`\n   User ${index + 1}: ${user.email}`);
      console.log(`     Name: ${user.full_name || 'NULL'}`);
      console.log(`     Initials: ${user.initials || 'NULL'} ${hasInitials}`);
      console.log(`     Role: ${user.role}`);
      console.log(`     Color: ${user.color_index || 'NULL'} ${hasColor}`);
    });
  }
  
  console.log('\n📋 SUMMARY:');
  console.log('- Testing automatic field generation for new users');
  console.log('- Verifying initials and color assignment works');
  console.log('- Identifying what needs to be fixed');
}

testAutomaticFields().then(() => {
  console.log('\n✅ Field generation testing complete');
}).catch(err => {
  console.log('❌ Test failed:', err.message);
});