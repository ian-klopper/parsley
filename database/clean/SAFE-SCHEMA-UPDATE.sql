-- ==================================================
-- SAFE SCHEMA UPDATE - Add Missing Fields
-- ==================================================
-- This adds missing fields to existing tables without dropping data
-- Run this INSTEAD of the full CLEAN-DATABASE-SCHEMA.sql if you have existing data

BEGIN;

-- ==============================================
-- ADD MISSING COLUMNS TO USERS TABLE
-- ==============================================

-- Add auth_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'auth_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN auth_id UUID UNIQUE;
    RAISE NOTICE 'Added auth_id column to users table';
  ELSE
    RAISE NOTICE 'auth_id column already exists';
  END IF;
END $$;

-- ==============================================
-- CHECK AND ADD MISSING COLUMNS TO JOBS TABLE
-- ==============================================

-- Add owner_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN owner_id UUID REFERENCES public.users(id) ON DELETE RESTRICT;
    RAISE NOTICE 'Added owner_id column to jobs table';
  ELSE
    RAISE NOTICE 'owner_id column already exists';
  END IF;
END $$;

-- Add last_activity column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'last_activity'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW();
    RAISE NOTICE 'Added last_activity column to jobs table';
  ELSE
    RAISE NOTICE 'last_activity column already exists';
  END IF;
END $$;

-- ==============================================
-- CREATE JOB_COLLABORATORS TABLE IF MISSING
-- ==============================================

CREATE TABLE IF NOT EXISTS public.job_collaborators (
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES public.users(id),
  PRIMARY KEY (job_id, user_id)
);

-- ==============================================
-- CREATE ACTIVITY_LOGS TABLE IF MISSING
-- ==============================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================
-- ADD MISSING INDEXES
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
DROP TRIGGER IF EXISTS users_updated_at_trigger ON public.users;
CREATE TRIGGER users_updated_at_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS jobs_updated_at_trigger ON public.jobs;
CREATE TRIGGER jobs_updated_at_trigger
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-populate user fields
DROP TRIGGER IF EXISTS users_auto_populate_trigger ON public.users;
CREATE TRIGGER users_auto_populate_trigger
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_populate_user_fields();

-- ==============================================
-- ENABLE RLS IF NOT ALREADY ENABLED
-- ==============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- UPDATE EXISTING DATA
-- ==============================================

-- Set owner_id to created_by for existing jobs if owner_id is NULL
UPDATE public.jobs
SET owner_id = created_by, updated_at = NOW()
WHERE owner_id IS NULL;

-- Update existing users to have proper initials and color_index
UPDATE public.users
SET
  initials = CASE
    WHEN initials IS NULL OR initials = '' THEN
      public.generate_initials(COALESCE(full_name, email))
    ELSE initials
  END,
  color_index = CASE
    WHEN color_index IS NULL THEN
      floor(random() * 12)::integer
    ELSE color_index
  END,
  updated_at = NOW()
WHERE initials IS NULL OR initials = '' OR color_index IS NULL;

-- ==============================================
-- VERIFICATION
-- ==============================================

SELECT 'Schema update completed successfully!' as status;

-- Show what was updated
SELECT
  'Users table' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN auth_id IS NOT NULL THEN 1 END) as with_auth_id
FROM public.users;

SELECT
  'Jobs table' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN owner_id IS NOT NULL THEN 1 END) as with_owner_id
FROM public.jobs;

COMMIT;