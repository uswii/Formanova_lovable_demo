-- Drop existing confusing restrictive policies
DROP POLICY IF EXISTS "Service role can manage batch_jobs" ON public.batch_jobs;
DROP POLICY IF EXISTS "Service role can manage batch_images" ON public.batch_images;

-- For batch_jobs: No direct access (all access via edge functions with service role)
-- Service role bypasses RLS automatically, so no policy needed for it
-- Deny all direct access from anon/authenticated roles
CREATE POLICY "Deny direct access to batch_jobs"
ON public.batch_jobs
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- For batch_images: Same approach - deny direct access
CREATE POLICY "Deny direct access to batch_images"  
ON public.batch_images
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);