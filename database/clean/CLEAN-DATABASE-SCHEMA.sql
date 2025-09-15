-- ==================================================
-- CLEAN DATABASE SCHEMA - Complete Rebuild
-- ==================================================
-- This replaces all the patched schemas with a clean, consistent design
-- Run this AFTER backing up your data

-- Drop existing objects to start fresh
DROP POLICY IF EXISTS "Users can view their own profile and approved users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Only admins can insert/delete users" ON public.users;
DROP POLICY IF EXISTS "Only admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Users can view logs based on role" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert their own logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can view jobs they have access to" ON public.jobs;
DROP POLICY IF EXISTS "Users can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update jobs they have access to" ON public.jobs;

-- Drop functions and triggers
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS generate_initials(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_jobs_for_user(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_user_role(UUID, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS transfer_job_ownership(UUID, UUID, UUID) CASCADE;

-- ==============================================
-- CLEAN SCHEMA DEFINITION
-- ==============================================

-- 1. USERS TABLE - Clean and consistent
CREATE TABLE IF NOT EXISTS public.users (
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
CREATE TABLE IF NOT EXISTS public.jobs (
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

-- 3. JOB COLLABORATORS - Proper junction table instead of arrays
CREATE TABLE IF NOT EXISTS public.job_collaborators (
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES public.users(id),
  PRIMARY KEY (job_id, user_id)
);

-- 4. ACTIVITY LOGS - With proper indexing
CREATE TABLE IF NOT EXISTS public.activity_logs (
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
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Jobs indexes
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON public.jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_jobs_owner_id ON public.jobs(owner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON public.jobs(job_id);

-- Job collaborators indexes
CREATE INDEX IF NOT EXISTS idx_job_collaborators_user_id ON public.job_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_job_collaborators_job_id ON public.job_collaborators(job_id);

-- Activity logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);

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
-- TRIGGERS
-- ==============================================

-- Auto-update timestamps
CREATE OR REPLACE TRIGGER users_updated_at_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER jobs_updated_at_trigger
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-populate user fields
CREATE OR REPLACE TRIGGER users_auto_populate_trigger
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_populate_user_fields();

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

-- Verification
SELECT 'Clean database schema created successfully!' as status;