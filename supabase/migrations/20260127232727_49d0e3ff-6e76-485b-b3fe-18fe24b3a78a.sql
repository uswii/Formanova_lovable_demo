-- Batch tracking enums
CREATE TYPE public.batch_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'partial');
CREATE TYPE public.skin_tone_type AS ENUM ('fair', 'light', 'medium', 'tan', 'dark', 'deep');
CREATE TYPE public.jewelry_category_type AS ENUM ('necklace', 'earring', 'ring', 'bracelet', 'watch');

-- Main batch jobs table
CREATE TABLE public.batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_display_name TEXT,
  jewelry_category jewelry_category_type NOT NULL,
  notification_email TEXT,
  status batch_status NOT NULL DEFAULT 'pending',
  total_images INTEGER NOT NULL DEFAULT 0,
  completed_images INTEGER NOT NULL DEFAULT 0,
  failed_images INTEGER NOT NULL DEFAULT 0,
  workflow_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Batch images table with full tracking
CREATE TABLE public.batch_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batch_jobs(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  original_url TEXT NOT NULL,
  result_url TEXT,
  mask_url TEXT,
  thumbnail_url TEXT,
  skin_tone skin_tone_type,
  classification_category TEXT,
  classification_is_worn BOOLEAN,
  classification_flagged BOOLEAN DEFAULT false,
  status batch_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies - allow service role full access (for edge functions)
CREATE POLICY "Service role can manage batch_jobs"
  ON public.batch_jobs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage batch_images"
  ON public.batch_images FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_batch_jobs_user_id ON public.batch_jobs(user_id);
CREATE INDEX idx_batch_jobs_status ON public.batch_jobs(status);
CREATE INDEX idx_batch_jobs_created_at ON public.batch_jobs(created_at DESC);
CREATE INDEX idx_batch_images_batch_id ON public.batch_images(batch_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_batch_jobs_updated_at
  BEFORE UPDATE ON public.batch_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_batch_images_updated_at
  BEFORE UPDATE ON public.batch_images
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();