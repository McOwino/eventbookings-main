ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_without_deposit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirm_warning_ack text;