-- Create RPC function to get jobs accessible by a user
-- This includes jobs they created, jobs they own, and jobs they collaborate on

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
  -- Admin users get all jobs (handled by RLS policies)
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