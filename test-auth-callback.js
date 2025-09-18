require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAuthCallback() {
  console.log('🧪 Testing auth callback user creation logic...\n');

  // Simulate what happens when a user signs in with OAuth
  const mockUser = {
    id: 'test-user-' + Date.now(),
    email: 'test@example.com',
    user_metadata: {
      full_name: 'Test User',
      name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg'
    }
  };

  console.log('1. Simulating new user OAuth callback...');
  console.log('   Mock user:', { id: mockUser.id, email: mockUser.email });

  try {
    // Check if user profile exists (this should fail for new user)
    console.log('\n2. Checking if user profile exists...');
    const { data: existingProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', mockUser.id)
      .single();

    if (profileError && (profileError.code === 'PGRST116' || profileError.message.includes('No rows returned'))) {
      console.log('✅ No profile found (as expected for new user)');
      
      // Create user profile (this is what our callback will do)
      console.log('\n3. Creating user profile...');
      const userInsert = {
        id: mockUser.id,
        email: mockUser.email,
        full_name: mockUser.user_metadata?.full_name || mockUser.user_metadata?.name || mockUser.email.split('@')[0],
        role: 'pending',
        avatar_url: mockUser.user_metadata?.avatar_url || null,
        color_index: Math.floor(Math.random() * 12)
      };

      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .insert([userInsert])
        .select('*')
        .single();

      if (createError) {
        console.error('❌ Failed to create user profile:', createError);
      } else {
        console.log('✅ User profile created successfully!');
        console.log('   Profile:', {
          id: newProfile.id,
          email: newProfile.email,
          full_name: newProfile.full_name,
          role: newProfile.role,
          color_index: newProfile.color_index
        });

        // Verify the user was created
        console.log('\n4. Verifying user in database...');
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('*');
        
        if (usersError) {
          console.error('❌ Error querying users:', usersError);
        } else {
          console.log(`✅ Total users in database: ${users.length}`);
          users.forEach(u => console.log(`   - ${u.email} (${u.role}) - ID: ${u.id}`));
        }

        // Clean up test user
        console.log('\n5. Cleaning up test user...');
        await supabase.from('users').delete().eq('id', mockUser.id);
        console.log('🧹 Test user cleaned up');
      }
    } else if (existingProfile) {
      console.log('User already exists:', existingProfile);
    } else {
      console.error('Unexpected error:', profileError);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  console.log('\n🎉 Auth callback test complete!');
  console.log('💡 If this worked, your OAuth callback should now create users automatically.');
}

testAuthCallback();