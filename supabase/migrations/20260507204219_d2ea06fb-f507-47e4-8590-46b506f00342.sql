ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS closed_by UUID;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS converted_lead_id UUID;