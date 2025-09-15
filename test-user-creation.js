require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testUserCreation() {
  console.log('🧪 PHASE 1.2: Testing User Creation Process');
  console.log('==========================================');
  
  // Test 1: Create user with explicit UUID
  console.log('\n1. Testing user creation with explicit UUID...');
  try {
    const testEmail = 'phase1test' + Date.now() + '@example.com';
    const testId = crypto.randomUUID();
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: testId,
        email: testEmail,
        full_name: 'Test User Phase 1',
        role: 'user'
      })
      .select()
      .single();
      
    if (error) throw error;
    console.log('✅ SUCCESS: User created with explicit UUID');
    console.log('   Email:', data.email);
    console.log('   ID:', data.id);
    console.log('   Full Name:', data.full_name);
    console.log('   Initials:', data.initials || 'NULL');
    console.log('   Role:', data.role);
    console.log('   Color Index:', data.color_index || 'NULL');
    
    // Test the auto-generation of initials
    if (!data.initials) {
      console.log('⚠️  Initials not auto-generated - fixing...');
      const { error: updateError } = await supabase
        .from('users')
        .update({ initials: 'TU' })
        .eq('id', data.id);
      if (!updateError) {
        console.log('✅ Initials manually fixed');
      }
    }
    
    return data;
    
  } catch (err) {
    console.log('❌ FAILED:', err.message);
  }
  
  // Test 2: Try creation without explicit ID (should fail due to auth.uid() default)
  console.log('\n2. Testing user creation without explicit UUID...');
  try {
    const testEmail2 = 'phase1test2' + Date.now() + '@example.com';
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: testEmail2,
        full_name: 'Test User No ID',
        role: 'user'
      })
      .select()
      .single();
      
    if (error) throw error;
    console.log('✅ SUCCESS: User created without explicit UUID');
    console.log('   Generated ID:', data.id);
    
  } catch (err) {
    console.log('❌ EXPECTED FAILURE:', err.message);
    if (err.message.includes('null value in column "id"')) {
      console.log('   🎯 CONFIRMED: auth.uid() returns null for service role');
      console.log('   💡 SOLUTION: Use gen_random_uuid() instead of auth.uid()');
    }
  }
}

async function fixUserCreationSchema() {
  console.log('\n🔧 FIXING USER CREATION SCHEMA');
  console.log('==============================');
  
  console.log('Creating SQL fix for user creation...');
  
  // We need to change the default from auth.uid() to gen_random_uuid()
  const fixSQL = `
-- Fix user creation by changing default ID generation
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Test the fix
SELECT 'User table ID default updated to gen_random_uuid()' as status;
`;
  
  console.log('📝 SQL Fix needed:');
  console.log(fixSQL);
  console.log('\n⚠️  Run this SQL in Supabase to fix user creation');
}

async function runTests() {
  await testUserCreation();
  await fixUserCreationSchema();
}

runTests().catch(console.error);