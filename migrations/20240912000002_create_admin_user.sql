-- Migration: Create Initial Admin User
-- Created: 2024-09-12T00:00:02.000Z
-- 
-- Description: Creates the first admin user and ensures proper setup
--

-- Create or update admin user
INSERT INTO public.users (id, email, full_name, role) 
VALUES (
  '9dc2a527-9c7a-4ab8-9ab8-2ed564ff01a6',
  'admin@parsley.com',  -- Update this email as needed
  'Admin User',         -- Update this name as needed
  'admin'
) 
ON CONFLICT (id) DO UPDATE SET 
  role = 'admin',
  updated_at = NOW();

-- Ensure initials are set for the admin user
UPDATE public.users 
SET initials = public.generate_initials(full_name) 
WHERE id = '9dc2a527-9c7a-4ab8-9ab8-2ed564ff01a6' AND initials IS NULL;

-- Log the admin creation
INSERT INTO public.activity_logs (user_id, action, status, details)
VALUES (
  '9dc2a527-9c7a-4ab8-9ab8-2ed564ff01a6',
  'Admin account created via migration',
  'success',
  '{"migration": "20240912000002_create_admin_user"}'::jsonb
);