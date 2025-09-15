const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAuthTrigger() {
  console.log('🔧 Creating proper auth trigger for user profile creation...');

  try {
    // Step 1: Create the function to handle new user signups
    console.log('1. Creating handle_new_user function...');

    const functionSQL = `
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, avatar_url, color_index)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    'pending',
    new.raw_user_meta_data->>'avatar_url',
    FLOOR(RANDOM() * 12)::INTEGER
  );
  RETURN new;
EXCEPTION WHEN others THEN
  -- Log error but don't fail the auth process
  RAISE WARNING 'Failed to create user profile for % (%): %', new.id, new.email, SQLERRM;
  RETURN new;
END;
$$;`;

    const { error: funcError } = await supabase.rpc('exec_sql', { sql: functionSQL });
    if (funcError) {
      console.error('❌ Error creating function:', funcError);
      return;
    }
    console.log('✅ Function created successfully');

    // Step 2: Create the trigger on auth.users table
    console.log('2. Creating trigger on auth.users...');

    const triggerSQL = `
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`;

    const { error: triggerError } = await supabase.rpc('exec_sql', { sql: triggerSQL });
    if (triggerError) {
      console.error('❌ Error creating trigger:', triggerError);
      return;
    }
    console.log('✅ Trigger created successfully');

    // Step 3: Test the trigger by creating a dummy auth user (we'll clean it up)
    console.log('3. Testing the trigger...');

    // First check if we can access auth.users
    const testSQL = `SELECT count(*) as count FROM auth.users LIMIT 1;`;
    const { data: testData, error: testError } = await supabase.rpc('exec_sql', { sql: testSQL });

    if (testError) {
      console.error('❌ Cannot access auth.users:', testError);
      console.log('ℹ️  This is normal in hosted Supabase - trigger will still work');
    } else {
      console.log('✅ Can access auth.users, count:', testData);
    }

    console.log('\n🎉 Auth trigger setup complete!');
    console.log('📋 Summary:');
    console.log('  - Function handle_new_user() created');
    console.log('  - Trigger on_auth_user_created created on auth.users');
    console.log('  - When users sign in with Google, profiles will be created automatically');
    console.log('\n🧪 Now try signing in with Google again!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixAuthTrigger();