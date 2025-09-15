-- Complete database setup script
-- Step 1: Run the full schema (copy from supabase-schema.sql)

-- Step 2: Create admin user
INSERT INTO public.users (id, email, full_name, role) 
VALUES (
  '9dc2a527-9c7a-4ab8-9ab8-2ed564ff01a6',
  'admin@example.com',  -- REPLACE WITH ACTUAL EMAIL
  'Admin User',         -- REPLACE WITH ACTUAL NAME  
  'admin'
) 
ON CONFLICT (id) DO UPDATE SET 
  role = 'admin',
  updated_at = NOW();

-- Step 3: Update user initials
UPDATE public.users 
SET initials = public.generate_initials(full_name) 
WHERE id = '9dc2a527-9c7a-4ab8-9ab8-2ed564ff01a6';

-- Step 4: Verify setup
SELECT 'Tables created:' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

SELECT 'Admin user:' as status;
SELECT id, email, full_name, role, initials, created_at 
FROM public.users 
WHERE id = '9dc2a527-9c7a-4ab8-9ab8-2ed564ff01a6';