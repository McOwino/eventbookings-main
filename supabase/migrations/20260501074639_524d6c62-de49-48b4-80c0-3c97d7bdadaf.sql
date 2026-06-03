ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS facility text,
  ADD COLUMN IF NOT EXISTS filled_by text;