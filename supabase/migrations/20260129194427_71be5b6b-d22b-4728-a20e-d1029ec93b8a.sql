-- Ensure RLS is enabled and forced on both tables
ALTER TABLE public.batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_jobs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.batch_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_images FORCE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them correctly
DROP POLICY IF EXISTS "Deny direct access to batch_jobs" ON public.batch_jobs;
DROP POLICY IF EXISTS "Deny direct access to batch_images" ON public.batch_images;

-- Create permissive policies that explicitly deny all access for anon and authenticated roles
-- With no permissive policies allowing access, RLS will deny everything by default
-- The service role used by edge functions bypasses RLS entirely

-- For batch_jobs: No SELECT/INSERT/UPDATE/DELETE allowed via direct access
CREATE POLICY "No direct select on batch_jobs"
  ON public.batch_jobs
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "No direct insert on batch_jobs"
  ON public.batch_jobs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "No direct update on batch_jobs"
  ON public.batch_jobs
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No direct delete on batch_jobs"
  ON public.batch_jobs
  FOR DELETE
  TO anon, authenticated
  USING (false);

-- For batch_images: No SELECT/INSERT/UPDATE/DELETE allowed via direct access
CREATE POLICY "No direct select on batch_images"
  ON public.batch_images
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "No direct insert on batch_images"
  ON public.batch_images
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "No direct update on batch_images"
  ON public.batch_images
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No direct delete on batch_images"
  ON public.batch_images
  FOR DELETE
  TO anon, authenticated
  USING (false);

-- Revoke direct table access from public/anon roles as additional protection
REVOKE ALL ON public.batch_jobs FROM anon;
REVOKE ALL ON public.batch_images FROM anon;