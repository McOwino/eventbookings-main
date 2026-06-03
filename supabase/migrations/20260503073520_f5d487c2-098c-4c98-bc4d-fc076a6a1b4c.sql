ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'buyout';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'walk_in_rsvp';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'third_party_event';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'in_house_event';

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.app_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins manage settings" ON public.app_settings
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

INSERT INTO public.app_settings (key, value) VALUES ('promotions_visible', 'true'::jsonb)
  ON CONFLICT (key) DO NOTHING;