ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS preferred_start_time text,
  ADD COLUMN IF NOT EXISTS preferred_end_time text;
