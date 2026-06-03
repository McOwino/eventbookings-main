-- Rename kids_club_members to membership
BEGIN;

-- Rename table
ALTER TABLE public.kids_club_members RENAME TO membership;

-- Optionally rename indexes for clarity (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_kids_club_expiry') THEN
    ALTER INDEX idx_kids_club_expiry RENAME TO idx_membership_expiry;
  END IF;
END$$;

COMMIT;
