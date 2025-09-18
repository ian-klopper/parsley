require('dotenv').config({ path: '.env.local' });

async function testUserCreationAPI() {
  console.log('🧪 Testing user creation API...\n');

  const testUser = {
    id: '550e8400-e29b-41d4-a716-446655440000', // Fixed UUID for testing
    email: 'test@example.com',
    full_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    color_index: 5
  };

  try {
    // Test the API endpoint
    console.log('1. Testing API endpoint...');
    const response = await fetch('http://localhost:8080/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ API endpoint works:', result);
    } else {
      console.error('❌ API endpoint failed:', result);
    }

    // Check if user was created in database
    console.log('\n2. Checking database...');
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', testUser.email);

    if (error) {
      console.error('❌ Database check failed:', error);
    } else {
      console.log(`✅ Found ${users.length} users with test email`);
      users.forEach(u => console.log(`   - ${u.email} (${u.role}) - ID: ${u.id}`));
    }

    // Clean up
    console.log('\n3. Cleaning up...');
    await supabase.from('users').delete().eq('id', testUser.id);
    console.log('🧹 Test user cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  console.log('\n🎉 Test complete!');
}

testUserCreationAPI();