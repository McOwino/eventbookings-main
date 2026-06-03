-- Add how_did_you_hear column to events to record marketing source
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS how_did_you_hear TEXT;

-- Optionally, you can add a check constraint to restrict values to known options.
-- Uncomment and adjust the list below if you prefer enforced enum-like values.
-- ALTER TABLE public.events
-- ADD CONSTRAINT events_how_did_you_hear_chk CHECK (
--   how_did_you_hear IS NULL OR how_did_you_hear IN (
--     'referral','repeat_client','social_media','search_engine','walk_in','online_review','paid_ad','email','texts','event_trade_show','billboard','flyer','radio','tv','podcast','press','blog','conference'
--   )
-- );
