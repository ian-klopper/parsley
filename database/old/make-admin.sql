-- Make user admin
UPDATE public.users 
SET role = 'admin',
    updated_at = NOW()
WHERE id = '9dc2a527-9c7a-4ab8-9ab8-2ed564ff01a6';

-- Verify the change
SELECT id, email, full_name, role, created_at, updated_at 
FROM public.users 
WHERE id = '9dc2a527-9c7a-4ab8-9ab8-2ed564ff01a6';