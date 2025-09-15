-- ==================================================
-- COMPLETE CLEAN REBUILD - Drops Everything
-- ==================================================
-- This completely rebuilds the database from scratch
-- WARNING: This will delete all existing data!
-- Only use this if you're okay with losing all data

BEGIN;

-- ==============================================
-- DROP EVERYTHING TO START FRESH
-- ==============================================

-- Drop all policies
DROP POLICY IF EXISTS "Users can view their own profile and approved users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Only admins can insert/delete users" ON public.users;
DROP POLICY IF EXISTS "Only admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Users can view logs based on role" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert their own logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can view jobs they have access to" ON public.jobs;
DROP POLICY IF EXISTS "Users can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update jobs they have access to" ON public.jobs;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_own_policy" ON public.users;
DROP POLICY IF EXISTS "users_admin_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_admin_delete_policy" ON public.users;
DROP POLICY IF EXISTS "jobs_access_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_create_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_policy" ON public.jobs;
DROP POLICY IF EXISTS "job_collaborators_select_policy" ON public.job_collaborators;
DROP POLICY IF EXISTS "job_collaborators_manage_policy" ON public.job_collaborators;
DROP POLICY IF EXISTS "activity_logs_select_policy" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert_policy" ON public.activity_logs;

-- Drop all functions and triggers (CASCADE will drop triggers)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS generate_initials(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_jobs_for_user(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_user_role(UUID, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS transfer_job_ownership(UUID, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS add_job_collaborator(UUID, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS remove_job_collaborator(UUID, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS auto_populate_user_fields() CASCADE;

-- Drop all tables (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.job_collaborators CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ==============================================
-- CREATE CLEAN SCHEMA FROM SCRATCH
-- ==============================================

-- 1. USERS TABLE - Clean and consistent
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE, -- References auth.users(id), but not enforced for flexibility
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  initials TEXT, -- Will be auto-generated via trigger
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'pending' CHECK (role IN ('pending', 'user', 'admin')),
  color_index INTEGER DEFAULT floor(random() * 12)::integer,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. JOBS TABLE - With owner_id from the start
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue TEXT NOT NULL,
  job_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'processing', 'complete', 'error')),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. JOB COLLABORATORS - Proper junction table
CREATE TABLE public.job_collaborators (
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES public.users(id),
  PRIMARY KEY (job_id, user_id)
);

-- 4. ACTIVITY LOGS - With proper indexing
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================

-- Users indexes
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_auth_id ON public.users(auth_id);
CREATE INDEX idx_users_role ON public.users(role);

-- Jobs indexes
CREATE INDEX idx_jobs_created_by ON public.jobs(created_by);
CREATE INDEX idx_jobs_owner_id ON public.jobs(owner_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_job_id ON public.jobs(job_id);

-- Job collaborators indexes
CREATE INDEX idx_job_collaborators_user_id ON public.job_collaborators(user_id);
CREATE INDEX idx_job_collaborators_job_id ON public.job_collaborators(job_id);

-- Activity logs indexes
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);

-- ==============================================
-- UTILITY FUNCTIONS
-- ==============================================

-- Function to generate user initials
CREATE OR REPLACE FUNCTION public.generate_initials(full_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF full_name IS NULL OR full_name = '' THEN
    RETURN '??';
  END IF;

  RETURN UPPER(
    SUBSTRING(split_part(full_name, ' ', 1), 1, 1) ||
    COALESCE(SUBSTRING(split_part(full_name, ' ', 2), 1, 1), '')
  );
END;
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function to auto-populate user fields
CREATE OR REPLACE FUNCTION public.auto_populate_user_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Auto-generate initials if full_name is provided
  IF NEW.full_name IS NOT NULL AND NEW.full_name != '' THEN
    NEW.initials = public.generate_initials(NEW.full_name);
  END IF;

  -- Ensure color_index is set
  IF NEW.color_index IS NULL THEN
    NEW.color_index = floor(random() * 12)::integer;
  END IF;

  -- Set timestamps
  IF TG_OP = 'INSERT' THEN
    NEW.created_at = NOW();
    NEW.updated_at = NOW();
  ELSE
    NEW.updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- ==============================================
-- USER MANAGEMENT FUNCTIONS
-- ==============================================

-- Function to handle new user registration from auth trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (auth_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'pending'
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- User already exists, ignore
    RETURN NEW;
END;
$$;

-- Function to update user role (admin only)
CREATE OR REPLACE FUNCTION public.update_user_role(
  p_user_id UUID,
  p_new_role TEXT,
  p_admin_id UUID
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  admin_user RECORD;
BEGIN
  -- Get admin user info
  SELECT * INTO admin_user FROM public.users WHERE id = p_admin_id;

  IF NOT FOUND OR admin_user.role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can update user roles';
  END IF;

  IF p_user_id = p_admin_id THEN
    RAISE EXCEPTION 'Administrators cannot change their own role';
  END IF;

  -- Update user role and approval info
  UPDATE public.users
  SET
    role = p_new_role,
    approved_at = CASE WHEN p_new_role != 'pending' THEN NOW() ELSE NULL END,
    approved_by = CASE WHEN p_new_role != 'pending' THEN p_admin_id ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Log the action
  INSERT INTO public.activity_logs (user_id, action, details, status)
  VALUES (
    p_admin_id,
    'User role updated',
    jsonb_build_object(
      'target_user_id', p_user_id,
      'new_role', p_new_role,
      'admin_id', p_admin_id
    ),
    'success'
  );
END;
$$;

-- ==============================================
-- JOB MANAGEMENT FUNCTIONS
-- ==============================================

-- Function to get jobs accessible by a user
CREATE OR REPLACE FUNCTION public.get_jobs_for_user(user_id UUID)
RETURNS TABLE (
  id UUID,
  venue TEXT,
  job_id TEXT,
  status TEXT,
  created_by UUID,
  owner_id UUID,
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  collaborator_count BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM public.users WHERE public.users.id = user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Return jobs based on user role and permissions
  RETURN QUERY
  SELECT
    j.id,
    j.venue,
    j.job_id,
    j.status,
    j.created_by,
    j.owner_id,
    j.last_activity,
    j.created_at,
    j.updated_at,
    COALESCE(collab_count.count, 0) as collaborator_count
  FROM public.jobs j
  LEFT JOIN (
    SELECT job_id, COUNT(*) as count
    FROM public.job_collaborators
    GROUP BY job_id
  ) collab_count ON collab_count.job_id = j.id
  WHERE
    user_role = 'admin' OR
    j.created_by = user_id OR
    j.owner_id = user_id OR
    EXISTS (
      SELECT 1 FROM public.job_collaborators jc
      WHERE jc.job_id = j.id AND jc.user_id = user_id
    )
  ORDER BY j.last_activity DESC;
END;
$$;

-- Function to transfer job ownership
CREATE OR REPLACE FUNCTION public.transfer_job_ownership(
  p_job_id UUID,
  p_new_owner_id UUID,
  p_current_user_id UUID
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_job RECORD;
  current_user_role TEXT;
  new_owner RECORD;
BEGIN
  -- Get current user role
  SELECT role INTO current_user_role FROM public.users WHERE id = p_current_user_id;

  -- Get job details
  SELECT * INTO current_job FROM public.jobs WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  -- Check permissions
  IF current_user_role != 'admin' AND
     p_current_user_id != current_job.owner_id AND
     p_current_user_id != current_job.created_by THEN
    RAISE EXCEPTION 'Only job owner, creator, or administrator can transfer ownership';
  END IF;

  -- Verify new owner exists and is not pending
  SELECT * INTO new_owner FROM public.users WHERE id = p_new_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'New owner not found';
  END IF;

  IF new_owner.role = 'pending' THEN
    RAISE EXCEPTION 'Cannot transfer ownership to pending users';
  END IF;

  -- Transfer ownership
  UPDATE public.jobs
  SET
    owner_id = p_new_owner_id,
    last_activity = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id;

  -- Ensure new owner is a collaborator
  INSERT INTO public.job_collaborators (job_id, user_id, added_by)
  VALUES (p_job_id, p_new_owner_id, p_current_user_id)
  ON CONFLICT (job_id, user_id) DO NOTHING;

  -- Log the transfer
  INSERT INTO public.activity_logs (user_id, action, details, status)
  VALUES (
    p_current_user_id,
    'Job ownership transferred',
    jsonb_build_object(
      'job_id', p_job_id,
      'previous_owner', current_job.owner_id,
      'new_owner', p_new_owner_id
    ),
    'success'
  );
END;
$$;

-- ==============================================
-- COLLABORATOR MANAGEMENT FUNCTIONS
-- ==============================================

-- Function to add collaborator to job
CREATE OR REPLACE FUNCTION public.add_job_collaborator(
  p_job_id UUID,
  p_user_email TEXT,
  p_current_user_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  target_user RECORD;
  current_job RECORD;
  current_user_role TEXT;
BEGIN
  -- Get current user role
  SELECT role INTO current_user_role FROM public.users WHERE id = p_current_user_id;

  -- Get job details
  SELECT * INTO current_job FROM public.jobs WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  -- Check permissions
  IF current_user_role != 'admin' AND
     p_current_user_id != current_job.owner_id AND
     p_current_user_id != current_job.created_by THEN
    RAISE EXCEPTION 'Only job owner, creator, or administrator can add collaborators';
  END IF;

  -- Find target user
  SELECT * INTO target_user FROM public.users WHERE email = p_user_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found with email: %', p_user_email;
  END IF;

  IF target_user.role = 'pending' THEN
    RAISE EXCEPTION 'Cannot add pending users as collaborators';
  END IF;

  -- Add collaborator
  INSERT INTO public.job_collaborators (job_id, user_id, added_by)
  VALUES (p_job_id, target_user.id, p_current_user_id)
  ON CONFLICT (job_id, user_id) DO NOTHING;

  -- Update job activity
  UPDATE public.jobs
  SET last_activity = NOW(), updated_at = NOW()
  WHERE id = p_job_id;

  -- Log the action
  INSERT INTO public.activity_logs (user_id, action, details, status)
  VALUES (
    p_current_user_id,
    'Collaborator added to job',
    jsonb_build_object(
      'job_id', p_job_id,
      'collaborator_id', target_user.id,
      'collaborator_email', p_user_email
    ),
    'success'
  );

  -- Return collaborator info
  RETURN jsonb_build_object(
    'id', target_user.id,
    'email', target_user.email,
    'full_name', target_user.full_name,
    'initials', target_user.initials
  );
END;
$$;

-- Function to remove collaborator from job
CREATE OR REPLACE FUNCTION public.remove_job_collaborator(
  p_job_id UUID,
  p_collaborator_id UUID,
  p_current_user_id UUID
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_job RECORD;
  current_user_role TEXT;
BEGIN
  -- Get current user role
  SELECT role INTO current_user_role FROM public.users WHERE id = p_current_user_id;

  -- Get job details
  SELECT * INTO current_job FROM public.jobs WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  -- Check permissions
  IF current_user_role != 'admin' AND
     p_current_user_id != current_job.owner_id AND
     p_current_user_id != current_job.created_by THEN
    RAISE EXCEPTION 'Only job owner, creator, or administrator can remove collaborators';
  END IF;

  -- Remove collaborator
  DELETE FROM public.job_collaborators
  WHERE job_id = p_job_id AND user_id = p_collaborator_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User is not a collaborator on this job';
  END IF;

  -- Update job activity
  UPDATE public.jobs
  SET last_activity = NOW(), updated_at = NOW()
  WHERE id = p_job_id;

  -- Log the action
  INSERT INTO public.activity_logs (user_id, action, details, status)
  VALUES (
    p_current_user_id,
    'Collaborator removed from job',
    jsonb_build_object(
      'job_id', p_job_id,
      'collaborator_id', p_collaborator_id
    ),
    'success'
  );
END;
$$;

-- ==============================================
-- TRIGGERS
-- ==============================================

-- Auto-update timestamps
CREATE TRIGGER users_updated_at_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER jobs_updated_at_trigger
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-populate user fields
CREATE TRIGGER users_auto_populate_trigger
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_populate_user_fields();

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ==============================================
-- ROW LEVEL SECURITY
-- ==============================================

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "users_select_policy" ON public.users
  FOR SELECT
  USING (
    auth.uid() = auth_id OR
    (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('admin', 'user')
  );

CREATE POLICY "users_update_own_policy" ON public.users
  FOR UPDATE
  USING (auth.uid() = auth_id);

CREATE POLICY "users_admin_insert_policy" ON public.users
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'admin' OR
    auth_id = auth.uid() -- Allow users to create their own profile
  );

CREATE POLICY "users_admin_delete_policy" ON public.users
  FOR DELETE
  USING ((SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'admin');

-- Jobs policies
CREATE POLICY "jobs_access_policy" ON public.jobs
  FOR SELECT
  USING (
    (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'admin' OR
    created_by = (SELECT id FROM public.users WHERE auth_id = auth.uid()) OR
    owner_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.job_collaborators jc
      WHERE jc.job_id = jobs.id
      AND jc.user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "jobs_create_policy" ON public.jobs
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('admin', 'user') AND
    created_by = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "jobs_update_policy" ON public.jobs
  FOR UPDATE
  USING (
    (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'admin' OR
    created_by = (SELECT id FROM public.users WHERE auth_id = auth.uid()) OR
    owner_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "jobs_delete_policy" ON public.jobs
  FOR DELETE
  USING (
    (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'admin' OR
    owner_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Job collaborators policies
CREATE POLICY "job_collaborators_select_policy" ON public.job_collaborators
  FOR SELECT
  USING (
    (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'admin' OR
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_collaborators.job_id
      AND (j.created_by = (SELECT id FROM public.users WHERE auth_id = auth.uid()) OR
           j.owner_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()))
    )
  );

CREATE POLICY "job_collaborators_manage_policy" ON public.job_collaborators
  FOR ALL
  USING (
    (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'admin' OR
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_collaborators.job_id
      AND (j.created_by = (SELECT id FROM public.users WHERE auth_id = auth.uid()) OR
           j.owner_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()))
    )
  );

-- Activity logs policies
CREATE POLICY "activity_logs_select_policy" ON public.activity_logs
  FOR SELECT
  USING (
    (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'admin' OR
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "activity_logs_insert_policy" ON public.activity_logs
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()) OR
    (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'admin'
  );

-- ==============================================
-- GRANT PERMISSIONS
-- ==============================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_jobs_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_job_ownership(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_job_collaborator(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_job_collaborator(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_initials(TEXT) TO authenticated;

COMMIT;

SELECT 'Complete database rebuild successful!' as status;