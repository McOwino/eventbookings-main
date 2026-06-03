CREATE TABLE public.kids_club_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kid_name TEXT NOT NULL,
  kid_dob DATE,
  guardian_names TEXT NOT NULL,
  guardian_phone TEXT,
  guardian_email TEXT,
  payment_amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  transaction_ref TEXT,
  membership_start DATE NOT NULL DEFAULT CURRENT_DATE,
  membership_expiry DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view kids club members"
  ON public.kids_club_members FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert kids club members"
  ON public.kids_club_members FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update kids club members"
  ON public.kids_club_members FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Super admins delete kids club members"
  ON public.kids_club_members FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_kids_club_members_updated_at
  BEFORE UPDATE ON public.kids_club_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_kids_club_expiry ON public.kids_club_members(membership_expiry);