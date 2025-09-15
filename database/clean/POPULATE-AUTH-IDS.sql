-- ==================================================
-- POPULATE AUTH IDS - Link users to Supabase Auth
-- ==================================================
-- This populates the auth_id field by matching emails
-- Run this AFTER SAFE-SCHEMA-UPDATE.sql

BEGIN;

-- ==============================================
-- POPULATE AUTH_ID FOR EXISTING USERS
-- ==============================================

-- Update users with matching auth.users records
UPDATE public.users
SET auth_id = auth_users.id, updated_at = NOW()
FROM auth.users auth_users
WHERE public.users.email = auth_users.email
AND public.users.auth_id IS NULL;

-- Show results
SELECT 'AUTH ID POPULATION RESULTS' as section;

SELECT
  COUNT(*) as total_users,
  COUNT(CASE WHEN auth_id IS NOT NULL THEN 1 END) as users_with_auth_id,
  COUNT(CASE WHEN auth_id IS NULL THEN 1 END) as users_without_auth_id
FROM public.users;

-- Show users without auth_id (these may need manual attention)
SELECT
  'Users without auth_id:' as info,
  email
FROM public.users
WHERE auth_id IS NULL;

COMMIT;

-- ==================================================
-- POST-MIGRATION NOTES
-- ==================================================
-- Users without auth_id may be:
-- 1. Old test data that doesn't have corresponding auth records
-- 2. Users created directly in the database bypassing Supabase Auth
-- 3. Users whose emails don't exactly match their auth.users email
--
-- For production, you may want to:
-- 1. Delete users without auth_id if they're test data
-- 2. Create auth.users records for legitimate users
-- 3. Manually match users with slight email differences