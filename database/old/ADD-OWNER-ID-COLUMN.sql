-- Add owner_id column to jobs table
-- This is the missing piece from the database setup

DO $$
BEGIN
    -- Check if owner_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'jobs'
        AND column_name = 'owner_id'
        AND table_schema = 'public'
    ) THEN
        -- Add the owner_id column
        ALTER TABLE public.jobs ADD COLUMN owner_id UUID REFERENCES public.users(id);

        -- Set owner_id to created_by for all existing jobs
        UPDATE public.jobs SET owner_id = created_by WHERE owner_id IS NULL;

        -- Make owner_id required for future jobs
        ALTER TABLE public.jobs ALTER COLUMN owner_id SET NOT NULL;

        RAISE NOTICE 'Successfully added owner_id column to jobs table';
    ELSE
        RAISE NOTICE 'owner_id column already exists in jobs table';
    END IF;
END $$;

-- Update RLS policies to include owner_id (in case they need updating)
DROP POLICY IF EXISTS "Users can view jobs they have access to" ON public.jobs;

CREATE POLICY "Users can view jobs they have access to" ON public.jobs
  FOR SELECT USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
    created_by = auth.uid() OR
    owner_id = auth.uid() OR
    auth.uid() = ANY(collaborators)
  );

DROP POLICY IF EXISTS "Users can update jobs they have access to" ON public.jobs;

CREATE POLICY "Users can update jobs they have access to" ON public.jobs
  FOR UPDATE USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
    created_by = auth.uid() OR
    owner_id = auth.uid()
  );

-- Verification
SELECT 'owner_id column setup completed successfully' as status;