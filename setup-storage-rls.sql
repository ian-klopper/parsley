-- Setup RLS policies for extraction-results storage bucket
-- This allows authenticated users to upload and manage their extraction results

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own extraction results" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own extraction results" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own extraction results" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own extraction results" ON storage.objects;

-- Allow authenticated users to upload files to extraction-results bucket
CREATE POLICY "Users can upload extraction results" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'extraction-results' AND
    auth.role() = 'authenticated'
  );

-- Allow users to view files in extraction-results bucket
CREATE POLICY "Users can view extraction results" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'extraction-results' AND
    auth.role() = 'authenticated'
  );

-- Allow users to update their own files in extraction-results bucket
CREATE POLICY "Users can update extraction results" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'extraction-results' AND
    auth.role() = 'authenticated'
  );

-- Allow users to delete their own files in extraction-results bucket
CREATE POLICY "Users can delete extraction results" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'extraction-results' AND
    auth.role() = 'authenticated'
  );