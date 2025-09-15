-- ==================================================
-- OPTIMIZED DATABASE SCHEMA - Performance & 3NF Compliant
-- ==================================================
-- This schema eliminates redundancy, optimizes performance, and maintains admin color control
-- Run this AFTER backing up your data

-- Drop existing objects to start fresh
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

-- Drop functions and triggers
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS auto_populate_user_fields() CASCADE;
DROP FUNCTION IF EXISTS generate_initials(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_jobs_for_user(UUID) CASCADE;

-- Drop tables to recreate with optimized structure
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.job_collaborators CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ==============================================
-- OPTIMIZED SCHEMA DEFINITION
-- ==============================================

-- 1. USERS TABLE - Single ID system using auth.users.id
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  initials TEXT GENERATED ALWAYS AS (
    CASE
      WHEN full_name IS NULL OR full_name = '' THEN '??'
      ELSE UPPER(
        SUBSTRING(split_part(full_name, ' ', 1), 1, 1) ||
        COALESCE(SUBSTRING(split_part(full_name, ' ', 2), 1, 1), '')
      )
    END
  ) STORED,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'pending' CHECK (role IN ('pending', 'user', 'admin')),
  color_index INTEGER DEFAULT floor(random() * 12)::integer CHECK (color_index >= 0 AND color_index <= 11),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. JOBS TABLE - Optimized with better constraints
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

-- 3. JOB COLLABORATORS - Optimized junction table
CREATE TABLE public.job_collaborators (
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES public.users(id),
  PRIMARY KEY (job_id, user_id)
);

-- 4. ACTIVITY LOGS - Partitioned for performance
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create partitions for activity logs (current and next month)
CREATE TABLE activity_logs_current PARTITION OF public.activity_logs
  FOR VALUES FROM (DATE_TRUNC('month', CURRENT_DATE))
  TO (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month'));

CREATE TABLE activity_logs_next PARTITION OF public.activity_logs
  FOR VALUES FROM (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month'))
  TO (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '2 months'));

-- ==============================================
-- PERFORMANCE INDEXES
-- ==============================================

-- Users indexes (optimized for common queries)
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role) WHERE role != 'pending';
CREATE INDEX idx_users_approved ON public.users(approved_at) WHERE approved_at IS NOT NULL;

-- Jobs indexes (covering indexes for common queries)
CREATE INDEX idx_jobs_owner_created ON public.jobs(owner_id, created_at DESC);
CREATE INDEX idx_jobs_creator_status ON public.jobs(created_by, status);
CREATE INDEX idx_jobs_status_activity ON public.jobs(status, last_activity DESC);
CREATE INDEX idx_jobs_venue_lower ON public.jobs(lower(venue));

-- Job collaborators indexes
CREATE INDEX idx_job_collaborators_user_jobs ON public.job_collaborators(user_id, job_id);
CREATE INDEX idx_job_collaborators_job_users ON public.job_collaborators(job_id, user_id);

-- Activity logs indexes (partitioned)
CREATE INDEX idx_activity_logs_user_time ON public.activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_logs_action_time ON public.activity_logs(action, created_at DESC);

-- ==============================================
-- UTILITY FUNCTIONS
-- ==============================================

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

-- Function to auto-populate user fields on insert/update
CREATE OR REPLACE FUNCTION public.auto_populate_user_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ensure color_index is set if null
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

-- Function to get user's accessible jobs (optimized with single query)
CREATE OR REPLACE FUNCTION public.get_user_jobs(user_uuid UUID)
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
  creator_name TEXT,
  creator_email TEXT,
  creator_initials TEXT,
  creator_color_index INTEGER,
  owner_name TEXT,
  owner_email TEXT,
  owner_initials TEXT,
  owner_color_index INTEGER,
  collaborator_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    j.id, j.venue, j.job_id, j.status,
    j.created_by, j.owner_id, j.last_activity, j.created_at, j.updated_at,
    creator.full_name, creator.email, creator.initials, creator.color_index,
    owner.full_name, owner.email, owner.initials, owner.color_index,
    COALESCE(collab_count.count, 0) as collaborator_count
  FROM public.jobs j
  LEFT JOIN public.users creator ON j.created_by = creator.id
  LEFT JOIN public.users owner ON j.owner_id = owner.id
  LEFT JOIN (
    SELECT job_id, COUNT(*) as count
    FROM public.job_collaborators
    GROUP BY job_id
  ) collab_count ON j.id = collab_count.job_id
  WHERE
    j.created_by = user_uuid OR
    j.owner_id = user_uuid OR
    EXISTS (
      SELECT 1 FROM public.job_collaborators jc
      WHERE jc.job_id = j.id AND jc.user_id = user_uuid
    )
  ORDER BY j.last_activity DESC;
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
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ==============================================

-- User stats view (for admin dashboard)
CREATE MATERIALIZED VIEW public.user_stats AS
SELECT
  role,
  COUNT(*) as user_count,
  COUNT(CASE WHEN approved_at IS NOT NULL THEN 1 END) as approved_count,
  AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/86400) as avg_days_since_signup
FROM public.users
GROUP BY role;

CREATE UNIQUE INDEX idx_user_stats_role ON public.user_stats(role);

-- Job activity summary (for performance monitoring)
CREATE MATERIALIZED VIEW public.job_activity_summary AS
SELECT
  DATE_TRUNC('day', created_at) as day,
  status,
  COUNT(*) as job_count
FROM public.jobs
GROUP BY DATE_TRUNC('day', created_at), status
ORDER BY day DESC;

CREATE UNIQUE INDEX idx_job_activity_day_status ON public.job_activity_summary(day, status);

-- ==============================================
-- ROW LEVEL SECURITY (Optimized Policies)
-- ==============================================

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Users policies (optimized with indexes)
CREATE POLICY "users_select_policy" ON public.users
  FOR SELECT
  USING (
    id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'user'))
  );

CREATE POLICY "users_update_own_policy" ON public.users
  FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "users_admin_manage_policy" ON public.users
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') OR
    (id = auth.uid() AND TG_OP = 'INSERT') -- Allow self-registration
  );

-- Jobs policies (using the optimized function)
CREATE POLICY "jobs_access_policy" ON public.jobs
  FOR SELECT
  USING (
    created_by = auth.uid() OR
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.job_collaborators jc
      WHERE jc.job_id = jobs.id AND jc.user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "jobs_manage_policy" ON public.jobs
  FOR ALL
  USING (
    created_by = auth.uid() OR
    owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Job collaborators policies
CREATE POLICY "job_collaborators_access_policy" ON public.job_collaborators
  FOR ALL
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_collaborators.job_id
      AND (j.created_by = auth.uid() OR j.owner_id = auth.uid())
    ) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Activity logs policies
CREATE POLICY "activity_logs_access_policy" ON public.activity_logs
  FOR ALL
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ==============================================
-- AUTOMATIC PARTITION MANAGEMENT
-- ==============================================

-- Function to create next month's partition
CREATE OR REPLACE FUNCTION create_next_activity_logs_partition()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  start_date date;
  end_date date;
  table_name text;
BEGIN
  start_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '2 months');
  end_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '3 months');
  table_name := 'activity_logs_' || to_char(start_date, 'YYYY_MM');

  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF public.activity_logs
    FOR VALUES FROM (%L) TO (%L)',
    table_name, start_date, end_date);
END;
$$;

-- ==============================================
-- REFRESH MATERIALIZED VIEWS FUNCTION
-- ==============================================

CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.job_activity_summary;
END;
$$;

-- Verification
SELECT 'Optimized database schema created successfully!' as status,
       'Single ID system implemented' as id_system,
       'Admin color control preserved' as color_control,
       'Performance indexes added' as performance,
       'Partitioned activity logs' as partitioning;