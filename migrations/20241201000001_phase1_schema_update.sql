-- Migration: Phase 1 Schema Update - Job Ownership and Enhanced Security
-- Created: 2024-12-01T00:00:01.000Z
-- 
-- Description: Adds owner_id field to jobs table and updates RLS policies for strict access control

-- Add owner_id field to jobs table for transferable ownership
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);

-- Update existing jobs to set owner_id = created_by for consistency
UPDATE public.jobs SET owner_id = created_by WHERE owner_id IS NULL;

-- Make owner_id NOT NULL now that we've populated it
ALTER TABLE public.jobs ALTER COLUMN owner_id SET NOT NULL;

-- Drop existing job policies to recreate them with enhanced security
DROP POLICY IF EXISTS "Users can view jobs they have access to" ON public.jobs;
DROP POLICY IF EXISTS "Users can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update jobs they have access to" ON public.jobs;
DROP POLICY IF EXISTS "Users can delete jobs they have access to" ON public.jobs;

-- Enhanced Jobs table policies with owner_id and pending user restrictions
CREATE POLICY "Users can view jobs they have access to" ON public.jobs
  FOR SELECT USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
    (
      (SELECT role FROM public.users WHERE id = auth.uid()) != 'pending' AND
      (owner_id = auth.uid() OR auth.uid() = ANY(collaborators))
    )
  );

CREATE POLICY "Non-pending users can create jobs" ON public.jobs
  FOR INSERT WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) != 'pending' AND
    created_by = auth.uid() AND
    owner_id = auth.uid()
  );

CREATE POLICY "Owners and admins can update jobs" ON public.jobs
  FOR UPDATE USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
    (
      (SELECT role FROM public.users WHERE id = auth.uid()) != 'pending' AND
      owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can delete jobs" ON public.jobs
  FOR DELETE USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
    (
      (SELECT role FROM public.users WHERE id = auth.uid()) != 'pending' AND
      owner_id = auth.uid()
    )
  );

-- Enhanced Activity logs policies - admins only for SELECT
DROP POLICY IF EXISTS "Users can view logs based on role" ON public.activity_logs;
CREATE POLICY "Only admins can view activity logs" ON public.activity_logs
  FOR SELECT USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- Enhanced Users table policies for admin management
DROP POLICY IF EXISTS "Users can view their own profile and approved users" ON public.users;
CREATE POLICY "Users can view profiles based on role" ON public.users
  FOR SELECT USING (
    auth.uid() = id OR 
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
    (
      (SELECT role FROM public.users WHERE id = auth.uid()) IN ('user') AND
      role IN ('user', 'admin')
    )
  );

-- Function to log activity
CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id UUID,
  p_action TEXT,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.activity_logs (user_id, action, details)
  VALUES (p_user_id, p_action, p_details)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle role changes and approval
CREATE OR REPLACE FUNCTION public.update_user_role(
  p_user_id UUID,
  p_new_role TEXT,
  p_admin_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  old_role TEXT;
  admin_role TEXT;
BEGIN
  -- Check if admin is trying to change their own role
  IF p_admin_id = p_user_id THEN
    RAISE EXCEPTION 'Admins cannot change their own role';
  END IF;
  
  -- Verify admin permissions
  SELECT role INTO admin_role FROM public.users WHERE id = p_admin_id;
  IF admin_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;
  
  -- Get current role
  SELECT role INTO old_role FROM public.users WHERE id = p_user_id;
  
  -- Update user role
  IF old_role = 'pending' AND p_new_role != 'pending' THEN
    -- User approval from pending
    UPDATE public.users 
    SET role = p_new_role, 
        approved_at = NOW(), 
        approved_by = p_admin_id 
    WHERE id = p_user_id;
    
    -- Log approval
    PERFORM public.log_activity(
      p_user_id, 
      'USER_APPROVED', 
      jsonb_build_object(
        'old_role', old_role,
        'new_role', p_new_role,
        'approved_by', p_admin_id
      )
    );
  ELSE
    -- Regular role change
    UPDATE public.users SET role = p_new_role WHERE id = p_user_id;
    
    -- Log role change
    PERFORM public.log_activity(
      p_user_id, 
      'USER_ROLE_CHANGED', 
      jsonb_build_object(
        'old_role', old_role,
        'new_role', p_new_role,
        'changed_by', p_admin_id
      )
    );
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to transfer job ownership
CREATE OR REPLACE FUNCTION public.transfer_job_ownership(
  p_job_id UUID,
  p_new_owner_id UUID,
  p_current_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  current_owner_id UUID;
  current_user_role TEXT;
  new_owner_role TEXT;
BEGIN
  -- Get current owner and user role
  SELECT owner_id INTO current_owner_id FROM public.jobs WHERE id = p_job_id;
  SELECT role INTO current_user_role FROM public.users WHERE id = p_current_user_id;
  SELECT role INTO new_owner_role FROM public.users WHERE id = p_new_owner_id;
  
  -- Check permissions (owner or admin can transfer)
  IF current_user_role != 'admin' AND current_owner_id != p_current_user_id THEN
    RAISE EXCEPTION 'Only job owner or admin can transfer ownership';
  END IF;
  
  -- Check new owner is not pending
  IF new_owner_role = 'pending' THEN
    RAISE EXCEPTION 'Cannot transfer ownership to pending user';
  END IF;
  
  -- Transfer ownership
  UPDATE public.jobs SET owner_id = p_new_owner_id WHERE id = p_job_id;
  
  -- Log transfer
  PERFORM public.log_activity(
    p_current_user_id, 
    'JOB_OWNERSHIP_TRANSFERRED', 
    jsonb_build_object(
      'job_id', p_job_id,
      'old_owner', current_owner_id,
      'new_owner', p_new_owner_id,
      'transferred_by', p_current_user_id
    )
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime on all tables for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;