-- Emergency bootstrap function to make first admin
-- This bypasses RLS for initial setup
CREATE OR REPLACE FUNCTION public.bootstrap_admin(user_id UUID)
RETURNS boolean AS $$
BEGIN
  -- Update user role to admin
  UPDATE public.users 
  SET role = 'admin', updated_at = NOW()
  WHERE id = user_id;
  
  -- Check if update was successful
  IF FOUND THEN
    -- Log the admin creation
    INSERT INTO public.activity_logs (user_id, action, status)
    VALUES (user_id, 'Bootstrap admin account created', 'success');
    
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Use the function to make the user admin
SELECT public.bootstrap_admin('9dc2a527-9c7a-4ab8-9ab8-2ed564ff01a6');

-- Clean up - remove the bootstrap function after use
DROP FUNCTION public.bootstrap_admin(UUID);