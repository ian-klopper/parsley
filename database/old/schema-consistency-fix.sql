-- Schema Consistency Fix
-- Ensures all schema changes and RPC functions are properly applied

-- 1. Ensure owner_id column exists on jobs table (from jobs-schema-migration.sql)
DO $$
BEGIN
    -- Add owner_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'jobs'
        AND column_name = 'owner_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.jobs ADD COLUMN owner_id UUID REFERENCES public.users(id);
    END IF;
END $$;

-- Set owner_id to created_by for existing jobs where owner_id is null
UPDATE public.jobs
SET owner_id = created_by
WHERE owner_id IS NULL;

-- Make owner_id NOT NULL if it isn't already
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'jobs'
        AND column_name = 'owner_id'
        AND table_schema = 'public'
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE public.jobs ALTER COLUMN owner_id SET NOT NULL;
    END IF;
END $$;

-- 2. Create get_jobs_for_user RPC function
CREATE OR REPLACE FUNCTION get_jobs_for_user(user_id UUID)
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_jobs_for_user(UUID) TO authenticated;

-- 3. Create update_user_role RPC function (referenced in admin routes)
CREATE OR REPLACE FUNCTION update_user_role(
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_user_role(UUID, TEXT, UUID) TO authenticated;

-- 4. Update RLS policies to include owner_id
DROP POLICY IF EXISTS "Users can view jobs they have access to" ON public.jobs;

CREATE POLICY "Users can view jobs they have access to" ON public.jobs
  FOR SELECT USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
    created_by = auth.uid() OR
    owner_id = auth.uid() OR
    auth.uid() = ANY(collaborators)
  );

-- Update job update policy to include owner
DROP POLICY IF EXISTS "Users can update jobs they have access to" ON public.jobs;
DROP POLICY IF EXISTS "authorized_job_updates" ON public.jobs;

CREATE POLICY "Users can update jobs they have access to" ON public.jobs
  FOR UPDATE USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
    created_by = auth.uid() OR
    owner_id = auth.uid()
  );

-- Verification
SELECT 'Schema consistency check complete' AS status;