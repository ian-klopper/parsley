
-- Add owner_id column to jobs table
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);

-- Set owner_id to created_by for existing jobs
UPDATE public.jobs
SET owner_id = created_by
WHERE owner_id IS NULL;

-- Make owner_id NOT NULL after setting values
ALTER TABLE public.jobs
ALTER COLUMN owner_id SET NOT NULL;

-- Update RLS policy to include owner_id
DROP POLICY IF EXISTS "Users can view jobs they have access to" ON public.jobs;

CREATE POLICY "Users can view jobs they have access to" ON public.jobs
  FOR SELECT USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
    created_by = auth.uid() OR
    owner_id = auth.uid() OR
    auth.uid() = ANY(collaborators)
  );

-- Update job update policy to include owner
DROP POLICY IF EXISTS "Users can update jobs they have access to" ON public.jobs;

CREATE POLICY "Users can update jobs they have access to" ON public.jobs
  FOR UPDATE USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
    created_by = auth.uid() OR
    owner_id = auth.uid()
  );
