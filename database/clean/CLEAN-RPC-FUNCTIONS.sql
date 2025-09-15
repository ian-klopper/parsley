-- ==================================================
-- CLEAN RPC FUNCTIONS - For API Operations
-- ==================================================
-- These functions provide a clean interface for the application

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

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

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
-- GRANT PERMISSIONS
-- ==============================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_jobs_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_job_ownership(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_job_collaborator(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_job_collaborator(UUID, UUID, UUID) TO authenticated;

SELECT 'RPC functions created successfully!' as status;