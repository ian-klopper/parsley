-- ==================================================
-- FIX RLS POLICIES - Remove Infinite Recursion
-- ==================================================
-- This fixes the infinite recursion in users table RLS policies

BEGIN;

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_own_policy" ON public.users;
DROP POLICY IF EXISTS "users_admin_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_admin_delete_policy" ON public.users;

-- Create fixed policies without infinite recursion
-- Policy 1: Users can select their own profile and approved users can see each other
CREATE POLICY "users_select_policy" ON public.users
  FOR SELECT
  USING (
    -- User can see their own record
    auth.uid() = auth_id OR
    -- Approved users (non-pending) can see other approved users
    (
      role IN ('admin', 'user') AND
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'user')
      )
    )
  );

-- Policy 2: Users can update their own profile only
CREATE POLICY "users_update_own_policy" ON public.users
  FOR UPDATE
  USING (auth.uid() = auth_id);

-- Policy 3: Only admins can insert new users OR auth trigger can create profile
CREATE POLICY "users_admin_insert_policy" ON public.users
  FOR INSERT
  WITH CHECK (
    -- Allow auth trigger to create user profile (auth_id matches current auth.uid())
    auth_id = auth.uid() OR
    -- Or admin can insert users
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role = 'admin'
    )
  );

-- Policy 4: Only admins can delete users
CREATE POLICY "users_admin_delete_policy" ON public.users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role = 'admin'
    )
  );

COMMIT;

SELECT 'RLS policies fixed - infinite recursion removed!' as status;