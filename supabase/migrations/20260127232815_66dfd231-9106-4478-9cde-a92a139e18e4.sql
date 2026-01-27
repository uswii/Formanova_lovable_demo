-- Fix search_path for security
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;