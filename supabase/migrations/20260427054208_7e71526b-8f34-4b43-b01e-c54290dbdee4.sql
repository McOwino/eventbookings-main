-- Facility showcase slides for the public "Our Facilities" section
CREATE TABLE public.facility_showcase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facility_showcase ENABLE ROW LEVEL SECURITY;

-- Public can view active slides
CREATE POLICY "Public can view active facility showcase"
ON public.facility_showcase FOR SELECT
USING (is_active = true);

-- Admins can view everything
CREATE POLICY "Admins view facility showcase"
ON public.facility_showcase FOR SELECT
USING (is_admin(auth.uid()));

-- Marketing/super admin manage
CREATE POLICY "Marketing manages facility showcase"
ON public.facility_showcase FOR ALL
USING (has_role(auth.uid(), 'marketing_executive'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'marketing_executive'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_facility_showcase_updated_at
BEFORE UPDATE ON public.facility_showcase
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_facility_showcase_position ON public.facility_showcase(position);
