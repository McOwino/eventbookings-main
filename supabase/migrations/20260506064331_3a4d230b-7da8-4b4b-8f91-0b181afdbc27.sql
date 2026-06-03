
CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  facility facility NOT NULL,
  description text,
  days_of_week smallint[] NOT NULL DEFAULT '{}',
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active tournaments" ON public.tournaments FOR SELECT USING (is_active = true);
CREATE POLICY "Admins view all tournaments" ON public.tournaments FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins insert tournaments" ON public.tournaments FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins update tournaments" ON public.tournaments FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Super admins delete tournaments" ON public.tournaments FOR DELETE USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
