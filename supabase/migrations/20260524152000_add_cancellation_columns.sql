-- Add cancellation_reason and cancellation_at columns to events
BEGIN;

ALTER TABLE IF EXISTS events
  ADD COLUMN IF NOT EXISTS cancellation_reason text NULL,
  ADD COLUMN IF NOT EXISTS cancellation_at timestamptz NULL;

COMMIT;