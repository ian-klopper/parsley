const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyAuthFix() {
  console.log('🔧 Applying auth trigger fix...');

  try {
    // First, create the function
    const createFunction = `
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO public.users (id, email, full_name, role, avatar_url, color_index)
        VALUES (
          new.id,
          new.email,
          COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          'pending',
          new.raw_user_meta_data->>'avatar_url',
          FLOOR(RANDOM() * 12)::INTEGER
        );
        RETURN new;
      EXCEPTION WHEN others THEN
        RAISE WARNING 'Failed to create user profile for %: %', new.id, SQLERRM;
        RETURN new;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    console.log('1. Creating handle_new_user function...');
    const { error: funcError } = await supabase.rpc('exec_sql', { sql: createFunction });

    if (funcError) {
      console.error('❌ Error creating function:', funcError);
    } else {
      console.log('✅ Function created successfully');
    }

    // Drop existing trigger if it exists
    console.log('2. Dropping existing trigger...');
    const dropTrigger = `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;`;
    const { error: dropError } = await supabase.rpc('exec_sql', { sql: dropTrigger });

    if (dropError) {
      console.error('❌ Error dropping trigger:', dropError);
    } else {
      console.log('✅ Existing trigger dropped');
    }

    // Create the trigger
    console.log('3. Creating auth trigger...');
    const createTrigger = `
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    `;

    const { error: triggerError } = await supabase.rpc('exec_sql', { sql: createTrigger });

    if (triggerError) {
      console.error('❌ Error creating trigger:', triggerError);
    } else {
      console.log('✅ Trigger created successfully');
    }

    console.log('\n🎉 Auth trigger fix complete! Now try signing in with Google.');

  } catch (error) {
    console.error('❌ Failed to apply auth fix:', error);
  }
}

applyAuthFix();