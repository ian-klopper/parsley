-- ==================================================
-- DATA MIGRATION SCRIPT
-- ==================================================
-- This script safely migrates data from the old patched schema
-- to the new clean schema. Run this AFTER applying the clean schema.
--
-- IMPORTANT:
-- 1. BACKUP your database before running this!
-- 2. Apply CLEAN-DATABASE-SCHEMA.sql first
-- 3. Apply CLEAN-RPC-FUNCTIONS.sql second
-- 4. Then run this migration script
--
-- Usage:
-- 1. Create backup: pg_dump -h your_host -U your_user your_db > backup.sql
-- 2. Apply clean schema files
-- 3. Run this migration script
-- ==================================================

-- Start transaction for safety
BEGIN;

-- ==================================================
-- STEP 1: MIGRATE USERS DATA
-- ==================================================

-- Create temporary table to hold old user data if needed
DO $$
BEGIN
  -- Check if we need to migrate auth_id field
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'auth_id' AND is_nullable = 'YES'
  ) AND EXISTS (
    SELECT 1 FROM public.users WHERE auth_id IS NULL LIMIT 1
  ) THEN

    RAISE NOTICE 'Migrating users with missing auth_id...';

    -- For users missing auth_id, try to match by email
    UPDATE public.users
    SET auth_id = auth_users.id
    FROM auth.users auth_users
    WHERE public.users.email = auth_users.email
    AND public.users.auth_id IS NULL;

    -- Report users that couldn't be matched
    RAISE NOTICE 'Users without matching auth records: %',
      (SELECT COUNT(*) FROM public.users WHERE auth_id IS NULL);
  END IF;
END $$;

-- Ensure all users have proper initials and color_index
UPDATE public.users
SET
  initials = CASE
    WHEN initials IS NULL OR initials = '' THEN
      public.generate_initials(COALESCE(full_name, email))
    ELSE initials
  END,
  color_index = CASE
    WHEN color_index IS NULL THEN
      floor(random() * 12)::integer
    ELSE color_index
  END,
  updated_at = NOW()
WHERE initials IS NULL OR initials = '' OR color_index IS NULL;

-- ==================================================
-- STEP 2: MIGRATE JOBS DATA
-- ==================================================

-- Check if jobs need owner_id migration
DO $$
BEGIN
  -- If owner_id column doesn't exist or has nulls, we need to migrate
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'owner_id'
  ) THEN
    RAISE EXCEPTION 'Jobs table missing owner_id column. Apply clean schema first!';
  END IF;

  -- Set owner_id to created_by for jobs missing owner_id
  UPDATE public.jobs
  SET owner_id = created_by, updated_at = NOW()
  WHERE owner_id IS NULL;

  RAISE NOTICE 'Updated % jobs with missing owner_id',
    (SELECT COUNT(*) FROM public.jobs WHERE owner_id = created_by);
END $$;

-- ==================================================
-- STEP 3: MIGRATE COLLABORATORS DATA
-- ==================================================

-- Migrate from array-based collaborators to junction table
DO $$
DECLARE
  job_record RECORD;
  collaborator_id UUID;
BEGIN
  -- Check if we have old array-based collaborators column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'collaborators'
    AND data_type = 'ARRAY'
  ) THEN

    RAISE NOTICE 'Migrating array-based collaborators to junction table...';

    -- Loop through each job with collaborators
    FOR job_record IN
      SELECT id, collaborators, created_by
      FROM public.jobs
      WHERE collaborators IS NOT NULL AND array_length(collaborators, 1) > 0
    LOOP
      -- Insert each collaborator into junction table
      FOREACH collaborator_id IN ARRAY job_record.collaborators
      LOOP
        INSERT INTO public.job_collaborators (job_id, user_id, added_by)
        VALUES (job_record.id, collaborator_id, job_record.created_by)
        ON CONFLICT (job_id, user_id) DO NOTHING;
      END LOOP;
    END LOOP;

    -- Drop the old collaborators array column after migration
    ALTER TABLE public.jobs DROP COLUMN IF EXISTS collaborators;

    RAISE NOTICE 'Collaborator migration complete. Dropped old collaborators column.';
  ELSE
    RAISE NOTICE 'No array-based collaborators found to migrate.';
  END IF;
END $$;

-- ==================================================
-- STEP 4: CLEAN UP AND VERIFY
-- ==================================================

-- Ensure all required fields are populated
UPDATE public.users
SET updated_at = NOW()
WHERE updated_at IS NULL;

UPDATE public.jobs
SET
  last_activity = COALESCE(last_activity, updated_at, created_at),
  updated_at = COALESCE(updated_at, created_at)
WHERE last_activity IS NULL OR updated_at IS NULL;

-- ==================================================
-- VERIFICATION QUERIES
-- ==================================================

-- Show migration results
SELECT 'MIGRATION SUMMARY' as section;

SELECT
  'Users' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN auth_id IS NOT NULL THEN 1 END) as with_auth_id,
  COUNT(CASE WHEN initials IS NOT NULL THEN 1 END) as with_initials,
  COUNT(CASE WHEN role != 'pending' THEN 1 END) as non_pending
FROM public.users;

SELECT
  'Jobs' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN owner_id IS NOT NULL THEN 1 END) as with_owner_id,
  COUNT(CASE WHEN created_by = owner_id THEN 1 END) as creator_is_owner
FROM public.jobs;

SELECT
  'Job Collaborators' as table_name,
  COUNT(*) as total_relationships,
  COUNT(DISTINCT job_id) as jobs_with_collaborators,
  COUNT(DISTINCT user_id) as users_as_collaborators
FROM public.job_collaborators;

SELECT
  'Activity Logs' as table_name,
  COUNT(*) as total_logs,
  COUNT(DISTINCT user_id) as unique_users
FROM public.activity_logs;

-- Check for any data integrity issues
SELECT 'DATA INTEGRITY CHECKS' as section;

-- Users without auth_id (should be empty after migration)
SELECT 'Users missing auth_id: ' || COUNT(*) as issue
FROM public.users WHERE auth_id IS NULL;

-- Jobs without owner_id (should be empty)
SELECT 'Jobs missing owner_id: ' || COUNT(*) as issue
FROM public.jobs WHERE owner_id IS NULL;

-- Orphaned job collaborators (should be empty)
SELECT 'Orphaned collaborators: ' || COUNT(*) as issue
FROM public.job_collaborators jc
LEFT JOIN public.jobs j ON j.id = jc.job_id
LEFT JOIN public.users u ON u.id = jc.user_id
WHERE j.id IS NULL OR u.id IS NULL;

-- Final success message
SELECT 'MIGRATION COMPLETED SUCCESSFULLY!' as status;

-- Commit the transaction
COMMIT;

-- ==================================================
-- POST-MIGRATION NOTES
-- ==================================================
-- After running this migration:
-- 1. Test your application thoroughly
-- 2. Verify all API endpoints work correctly
-- 3. Check that user roles and permissions function as expected
-- 4. Ensure job ownership and collaboration features work
-- 5. Monitor for any remaining errors in your application logs
--
-- If you encounter issues:
-- 1. Check the verification query results above
-- 2. Review your application's API error logs
-- 3. Ensure the clean schema and RPC functions were applied correctly
-- ==================================================