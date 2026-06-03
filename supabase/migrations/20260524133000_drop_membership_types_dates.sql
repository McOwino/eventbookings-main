-- Drop start_date and end_date columns from membership_types
BEGIN;

ALTER TABLE IF EXISTS membership_types
  DROP COLUMN IF EXISTS start_date,
  DROP COLUMN IF EXISTS end_date;

COMMIT;