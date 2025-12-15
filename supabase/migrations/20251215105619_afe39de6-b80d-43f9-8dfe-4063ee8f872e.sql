-- Create generations history table
CREATE TABLE public.generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_image TEXT NOT NULL,
  generated_image TEXT NOT NULL,
  mask_image TEXT,
  prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- Users can only view their own generations
CREATE POLICY "Users can view their own generations"
ON public.generations
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own generations
CREATE POLICY "Users can insert their own generations"
ON public.generations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own generations
CREATE POLICY "Users can delete their own generations"
ON public.generations
FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_generations_user_id ON public.generations(user_id);
CREATE INDEX idx_generations_created_at ON public.generations(created_at DESC);