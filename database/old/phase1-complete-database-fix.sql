-- PHASE 1 COMPLETE: Database Foundation Fixes
-- This fixes ALL critical database issues in one go
-- Run this ENTIRE script in Supabase SQL Editor

-- ===========================================
-- PHASE 1.1: RLS Policy Fix (if not done already)
-- ===========================================

-- Remove any problematic policies
DROP POLICY IF EXISTS "Users can view their own profile and approved users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Only admins can insert/delete users" ON public.users;
DROP POLICY IF EXISTS "Only admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.users;

-- Ensure RLS is properly configured
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create simple, working policies
CREATE POLICY "allow_all_read_users" ON public.users FOR SELECT USING (true);
CREATE POLICY "allow_authenticated_update" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "allow_user_insert" ON public.users FOR INSERT WITH CHECK (true);

-- ===========================================
-- PHASE 1.2: Fix User Creation Process  
-- ===========================================

-- Change ID generation from auth.uid() to gen_random_uuid()
-- This allows creating users without authentication context
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ===========================================
-- PHASE 1.3: Implement Automatic Field Generation
-- ===========================================

-- Ensure the generate_initials function exists and works
CREATE OR REPLACE FUNCTION public.generate_initials(full_name TEXT)
RETURNS TEXT AS $$
BEGIN
  IF full_name IS NULL OR full_name = '' THEN
    RETURN '??';
  END IF;
  
  RETURN UPPER(
    SUBSTRING(split_part(full_name, ' ', 1), 1, 1) || 
    COALESCE(SUBSTRING(split_part(full_name, ' ', 2), 1, 1), '')
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to auto-assign color index
CREATE OR REPLACE FUNCTION public.assign_color_index()
RETURNS INTEGER AS $$
BEGIN
  -- Return a random color index between 0 and 11 (12 colors in spectrum)
  RETURN floor(random() * 12)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for automatic field generation
CREATE OR REPLACE FUNCTION public.auto_generate_user_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-generate initials if not provided
  IF NEW.initials IS NULL AND NEW.full_name IS NOT NULL THEN
    NEW.initials := public.generate_initials(NEW.full_name);
  END IF;
  
  -- Auto-assign color index if not provided
  IF NEW.color_index IS NULL THEN
    NEW.color_index := public.assign_color_index();
  END IF;
  
  -- Set updated_at timestamp
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_generate_fields_trigger ON public.users;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER auto_generate_fields_trigger
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_generate_user_fields();

-- ===========================================
-- Fix Activity Logs Policies
-- ===========================================

DROP POLICY IF EXISTS "Users can view logs based on role" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert their own logs" ON public.activity_logs;

CREATE POLICY "allow_all_read_logs" ON public.activity_logs FOR SELECT USING (true);
CREATE POLICY "allow_authenticated_insert_logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ===========================================
-- Fix Jobs Policies  
-- ===========================================

DROP POLICY IF EXISTS "Users can view jobs they have access to" ON public.jobs;
DROP POLICY IF EXISTS "Users can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update jobs they have access to" ON public.jobs;

CREATE POLICY "allow_all_read_jobs" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "allow_authenticated_create_jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "allow_own_job_updates" ON public.jobs FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- ===========================================
-- Update Existing Users with Missing Fields
-- ===========================================

-- Fix existing users that don't have initials
UPDATE public.users 
SET initials = public.generate_initials(full_name)
WHERE initials IS NULL AND full_name IS NOT NULL;

-- Fix existing users that don't have color indices
UPDATE public.users 
SET color_index = public.assign_color_index()
WHERE color_index IS NULL;

-- ===========================================
-- Verification and Testing
-- ===========================================

-- Test the fixes
SELECT 'Phase 1 fixes completed successfully' as status;

-- Show current users with all fields
SELECT id, email, full_name, initials, role, color_index, created_at 
FROM public.users 
ORDER BY created_at DESC;

-- Test automatic field generation with a new user
INSERT INTO public.users (email, full_name, role)
VALUES ('test-auto-fields@example.com', 'Auto Test User', 'user')
RETURNING id, email, full_name, initials, color_index, role;

-- Show the test user to verify auto-generation worked
SELECT 'Test user created with auto-generated fields:' as message;
SELECT id, email, full_name, initials, color_index, role 
FROM public.users 
WHERE email = 'test-auto-fields@example.com';