-- ==================================================
-- CRITICAL DATABASE FIXES - Apply in Supabase SQL Editor
-- ==================================================
-- Run this ENTIRE script in the Supabase SQL Editor to fix all issues

-- 1. Add owner_id column to jobs table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'jobs'
        AND column_name = 'owner_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.jobs ADD COLUMN owner_id UUID REFERENCES public.users(id);

        -- Set owner_id to created_by for existing jobs
        UPDATE public.jobs SET owner_id = created_by WHERE owner_id IS NULL;

        -- Make owner_id NOT NULL
        ALTER TABLE public.jobs ALTER COLUMN owner_id SET NOT NULL;

        RAISE NOTICE 'Added owner_id column to jobs table';
    ELSE
        RAISE NOTICE 'owner_id column already exists';
    END IF;
END $$;

-- 2. Create get_jobs_for_user RPC function
CREATE OR REPLACE FUNCTION public.get_jobs_for_user(user_id UUID)
RETURNS TABLE (
  id UUID,
  venue TEXT,
  job_id TEXT,
  status TEXT,
  created_by UUID,
  owner_id UUID,
  collaborators UUID[],
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return jobs where user is creator, owner, or collaborator
  -- Admin users get all jobs
  RETURN QUERY
  SELECT
    j.id,
    j.venue,
    j.job_id,
    j.status,
    j.created_by,
    j.owner_id,
    j.collaborators,
    j.last_activity,
    j.created_at,
    j.updated_at
  FROM jobs j
  WHERE
    (SELECT role FROM users WHERE users.id = user_id) = 'admin'
    OR j.created_by = user_id
    OR j.owner_id = user_id
    OR user_id = ANY(j.collaborators)
  ORDER BY j.last_activity DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_jobs_for_user(UUID) TO authenticated;

-- 3. Create update_user_role RPC function
CREATE OR REPLACE FUNCTION public.update_user_role(
  p_user_id UUID,
  p_new_role TEXT,
  p_admin_id UUID
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin has permission
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;

  -- Prevent admin from changing their own role
  IF p_user_id = p_admin_id THEN
    RAISE EXCEPTION 'Admins cannot change their own role';
  END IF;

  -- Update the user role
  UPDATE users
  SET
    role = p_new_role,
    approved_at = CASE WHEN p_new_role != 'pending' THEN NOW() ELSE NULL END,
    approved_by = CASE WHEN p_new_role != 'pending' THEN p_admin_id ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, TEXT, UUID) TO authenticated;

-- 4. Create job ownership transfer function
CREATE OR REPLACE FUNCTION public.transfer_job_ownership(
  p_job_id UUID,
  p_new_owner_id UUID,
  p_current_user_id UUID
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_job RECORD;
  current_user_role TEXT;
  new_owner RECORD;
BEGIN
  -- Get current user role
  SELECT role INTO current_user_role FROM users WHERE id = p_current_user_id;

  -- Get job details
  SELECT * INTO current_job FROM jobs WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  -- Check permissions: only owner, creator, or admin can transfer
  IF current_user_role != 'admin' AND
     p_current_user_id != current_job.owner_id AND
     p_current_user_id != current_job.created_by THEN
    RAISE EXCEPTION 'Permission denied. Only job owner, creator, or admin can transfer ownership';
  END IF;

  -- Verify new owner exists and is not pending
  SELECT * INTO new_owner FROM users WHERE id = p_new_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'New owner not found';
  END IF;

  IF new_owner.role = 'pending' THEN
    RAISE EXCEPTION 'Cannot transfer ownership to pending users';
  END IF;

  -- Transfer ownership
  UPDATE jobs
  SET
    owner_id = p_new_owner_id,
    last_activity = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id;

  -- Add new owner as collaborator if they aren't already
  IF NOT (p_new_owner_id = ANY(current_job.collaborators)) THEN
    UPDATE jobs
    SET collaborators = array_append(collaborators, p_new_owner_id)
    WHERE id = p_job_id;
  END IF;

END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.transfer_job_ownership(UUID, UUID, UUID) TO authenticated;

-- 5. Update RLS policies to include owner_id
DROP POLICY IF EXISTS "Users can view jobs they have access to" ON public.jobs;

CREATE POLICY "Users can view jobs they have access to" ON public.jobs
  FOR SELECT USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
    created_by = auth.uid() OR
    owner_id = auth.uid() OR
    auth.uid() = ANY(collaborators)
  );

-- Update job update policy
DROP POLICY IF EXISTS "Users can update jobs they have access to" ON public.jobs;
DROP POLICY IF EXISTS "authorized_job_updates" ON public.jobs;

CREATE POLICY "Users can update jobs they have access to" ON public.jobs
  FOR UPDATE USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
    created_by = auth.uid() OR
    owner_id = auth.uid()
  );

-- 6. Test the functions
DO $$
DECLARE
    test_result TEXT;
BEGIN
    -- Test that functions exist
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_jobs_for_user') THEN
        test_result := 'get_jobs_for_user function created';
        RAISE NOTICE '%', test_result;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_user_role') THEN
        test_result := 'update_user_role function created';
        RAISE NOTICE '%', test_result;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'transfer_job_ownership') THEN
        test_result := 'transfer_job_ownership function created';
        RAISE NOTICE '%', test_result;
    END IF;
END $$;

-- Final verification
SELECT 'DATABASE FIXES APPLIED SUCCESSFULLY' as status;