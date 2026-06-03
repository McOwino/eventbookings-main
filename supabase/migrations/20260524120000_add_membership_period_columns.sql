-- Add membership period columns to store the validity chosen per-member
BEGIN;

ALTER TABLE IF EXISTS membership
  ADD COLUMN IF NOT EXISTS membership_period_value integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS membership_period_unit text DEFAULT 'year';

-- OPTIONAL: If you plan to stop using start_date/end_date on membership_types,
-- consider making them nullable first, migrate data as needed, then drop them.
-- Example to make nullable:
-- ALTER TABLE IF EXISTS membership_types ALTER COLUMN start_date DROP NOT NULL;
-- ALTER TABLE IF EXISTS membership_types ALTER COLUMN end_date DROP NOT NULL;

COMMIT;