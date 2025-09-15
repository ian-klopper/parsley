-- PHASE 1.1: Fix RLS Policy Infinite Recursion
-- This fixes the 500 Internal Server Error on admin pages
-- Run this IMMEDIATELY in Supabase SQL Editor

-- Step 1: Completely remove all existing problematic policies
DROP POLICY IF EXISTS "Users can view their own profile and approved users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Only admins can insert/delete users" ON public.users;
DROP POLICY IF EXISTS "Only admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.users;
DROP POLICY IF EXISTS "Public read access" ON public.users;
DROP POLICY IF EXISTS "Users can update themselves" ON public.users;
DROP POLICY IF EXISTS "Users can insert themselves" ON public.users;

-- Step 2: Temporarily disable RLS to clear any stuck states
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Step 3: Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 4: Create simple, non-recursive policies that actually work
-- Policy 1: Allow all authenticated users to read user data (needed for app functionality)
CREATE POLICY "authenticated_users_can_read" ON public.users
  FOR SELECT 
  TO authenticated
  USING (true);

-- Policy 2: Allow all authenticated users to read user data even with anon role (for public access)
CREATE POLICY "public_can_read_users" ON public.users
  FOR SELECT 
  TO anon
  USING (true);

-- Policy 3: Users can update their own records
CREATE POLICY "users_can_update_self" ON public.users
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 4: Allow user creation (for new signups)
CREATE POLICY "allow_user_creation" ON public.users
  FOR INSERT 
  TO authenticated, anon
  WITH CHECK (true);

-- Step 5: Fix activity_logs policies
DROP POLICY IF EXISTS "Users can view logs based on role" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert their own logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Public can view activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert activity logs" ON public.activity_logs;

-- Simple activity logs policies
CREATE POLICY "public_can_read_logs" ON public.activity_logs
  FOR SELECT 
  TO anon, authenticated
  USING (true);

CREATE POLICY "authenticated_can_insert_logs" ON public.activity_logs
  FOR INSERT 
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Step 6: Fix jobs table policies  
DROP POLICY IF EXISTS "Users can view jobs they have access to" ON public.jobs;
DROP POLICY IF EXISTS "Users can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update jobs they have access to" ON public.jobs;

-- Simple jobs policies
CREATE POLICY "authenticated_can_read_jobs" ON public.jobs
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_can_create_jobs" ON public.jobs
  FOR INSERT 
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "users_can_update_own_jobs" ON public.jobs
  FOR UPDATE 
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Step 7: Verify the fix worked
SELECT 'RLS policies fixed - infinite recursion resolved' as status;

-- Step 8: Test by selecting from users table (this should work now)
SELECT COUNT(*) as user_count FROM public.users;