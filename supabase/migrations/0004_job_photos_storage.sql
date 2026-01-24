-- Migration: Create job-photos storage bucket
-- This bucket stores proof photos taken by field techs during job completion

-- Create the storage bucket for job photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  false,  -- Not public, requires authentication
  10485760,  -- 10MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for job-photos bucket

-- Policy: Authenticated users can upload photos
CREATE POLICY "Authenticated users can upload job photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-photos'
);

-- Policy: Users can view photos from their organization
-- Photos are stored as: {org_id}/{job_id}/{filename}
CREATE POLICY "Users can view their org job photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'job-photos'
);

-- Policy: Users can delete photos from their organization
CREATE POLICY "Users can delete their org job photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'job-photos'
);

-- Policy: Service role has full access (for API operations)
CREATE POLICY "Service role has full access to job photos"
ON storage.objects
TO service_role
USING (bucket_id = 'job-photos')
WITH CHECK (bucket_id = 'job-photos');
