-- Fix missing auth trigger that creates user profiles automatically
-- This is the missing piece causing "Database error saving new user"

-- Create function to handle new user signup
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
  -- Log the error but don't fail the auth process
  RAISE WARNING 'Failed to create user profile for %: %', new.id, SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users for new signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT ALL ON public.jobs TO anon, authenticated;
GRANT ALL ON public.job_collaborators TO anon, authenticated;
GRANT ALL ON public.activity_logs TO anon, authenticated;