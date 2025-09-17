-- Drop existing function
DROP FUNCTION IF EXISTS public.get_jobs_for_user(UUID);

-- Recreate with fixed column reference (using table aliases to avoid ambiguity)
CREATE OR REPLACE FUNCTION public.get_jobs_for_user(p_user_id UUID)
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
  v_user_role TEXT;
BEGIN
  -- Get user role
  SELECT u.role INTO v_user_role
  FROM public.users u
  WHERE u.id = p_user_id;

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
    SELECT jc.job_id as jid, COUNT(*) as count
    FROM public.job_collaborators jc
    GROUP BY jc.job_id
  ) collab_count ON collab_count.jid = j.id
  WHERE
    v_user_role = 'admin' OR
    j.created_by = p_user_id OR
    j.owner_id = p_user_id OR
    EXISTS (
      SELECT 1 FROM public.job_collaborators jc2
      WHERE jc2.job_id = j.id AND jc2.user_id = p_user_id
    )
  ORDER BY j.last_activity DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_jobs_for_user(UUID) TO authenticated;