-- Preferred time columns for interest form
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS preferred_start_time text,
  ADD COLUMN IF NOT EXISTS preferred_end_time text;

-- Ensure anonymous users can submit the public interest form
DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;
CREATE POLICY "Anyone can submit a lead"
  ON public.leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SECURITY DEFINER RPC so public submit works even if RLS policies drift
CREATE OR REPLACE FUNCTION public.submit_public_lead(
  p_name text,
  p_phone text,
  p_email text,
  p_event_type public.event_type,
  p_facility text DEFAULT NULL,
  p_preferred_date date DEFAULT NULL,
  p_preferred_start_time text DEFAULT NULL,
  p_preferred_end_time text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_filled_by text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.leads (
    name,
    phone,
    email,
    event_type,
    facility,
    preferred_date,
    preferred_start_time,
    preferred_end_time,
    notes,
    filled_by
  )
  VALUES (
    p_name,
    p_phone,
    p_email,
    p_event_type,
    p_facility,
    p_preferred_date,
    p_preferred_start_time,
    p_preferred_end_time,
    p_notes,
    p_filled_by
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_lead(
  text, text, text, public.event_type, text, date, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_public_lead(
  text, text, text, public.event_type, text, date, text, text, text, text
) TO anon, authenticated;
