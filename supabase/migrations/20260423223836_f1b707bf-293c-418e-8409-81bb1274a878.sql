-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM (
  'super_admin',
  'general_executive',
  'clearance_executive',
  'school_trips_executive',
  'birthday_executive',
  'league_executive',
  'marketing_executive',
  'logistics_executive',
  'hangout_executive',
  'sales_executive'
);

CREATE TYPE public.event_type AS ENUM ('birthday', 'school_trip', 'hangout', 'league_tournament');
CREATE TYPE public.event_status AS ENUM ('tentative', 'confirmed', 'cleared', 'canceled');
CREATE TYPE public.facility AS ENUM (
  'village_bowl',
  'under_the_sea',
  'ozone_trampoline_park',
  'mini_golf',
  'rev',
  'glitch',
  'ballpoint'
);
CREATE TYPE public.payment_mode AS ENUM ('mpesa', 'card', 'cash');
CREATE TYPE public.source_type AS ENUM ('in_bound', 'out_bound');

-- ============ TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer to safely check roles inside RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: any admin role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

-- ============ EVENTS ============
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT,
  birthday_persons JSONB DEFAULT '[]'::jsonb,
  event_type event_type NOT NULL,
  facility facility NOT NULL,
  event_space TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  package_name TEXT NOT NULL,
  package_options JSONB DEFAULT '[]'::jsonb,
  cost_per_person NUMERIC(10,2) NOT NULL DEFAULT 0,
  pax INT NOT NULL DEFAULT 10,
  status event_status NOT NULL DEFAULT 'tentative',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_events_date ON public.events(event_date);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_type ON public.events(event_type);

CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  mode payment_mode NOT NULL,
  date_paid DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  confirmation_code TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_payments_event ON public.payments(event_id);

-- ============ CLEARANCES ============
CREATE TABLE public.clearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  actual_pax INT NOT NULL,
  source source_type NOT NULL,
  out_bound_contact TEXT,
  hameco_per_person NUMERIC(10,2) NOT NULL DEFAULT 0,
  hameco_package_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  hameco_additional_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  hameco_additional_details TEXT,
  total_hameco_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  kiddie_meal_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  additional_food_order NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_fameco_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit NUMERIC(12,2) NOT NULL DEFAULT 0,
  top_up_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  cleared_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clearances ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_clearances_updated_at
BEFORE UPDATE ON public.clearances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PROMOTIONS ============
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  facility facility,
  starts_at DATE,
  ends_at DATE,
  event_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CONTRACTS ============
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  signature_url TEXT,
  generated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_contracts_event ON public.contracts(event_id);

-- ============ RLS POLICIES ============

-- PROFILES: users see/update their own; admins can view all
CREATE POLICY "Users view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- USER ROLES: only super_admin manages; users can view their own
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admins view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- EVENTS: public can READ (drives public calendar). Admins manage.
CREATE POLICY "Public can view events" ON public.events
  FOR SELECT USING (true);
CREATE POLICY "Admins can insert events" ON public.events
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update events" ON public.events
  FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Super admins can delete events" ON public.events
  FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'));

-- PAYMENTS: admin-only
CREATE POLICY "Admins view payments" ON public.payments
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert payments" ON public.payments
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update payments" ON public.payments
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- CLEARANCES: admin-only
CREATE POLICY "Admins view clearances" ON public.clearances
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert clearances" ON public.clearances
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update clearances" ON public.clearances
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- PROMOTIONS: public can read active ones; marketing/super_admin manage
CREATE POLICY "Public can view active promotions" ON public.promotions
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins view all promotions" ON public.promotions
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Marketing manages promotions" ON public.promotions
  FOR ALL USING (
    public.has_role(auth.uid(), 'marketing_executive')
    OR public.has_role(auth.uid(), 'super_admin')
  ) WITH CHECK (
    public.has_role(auth.uid(), 'marketing_executive')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- CONTRACTS: admin-only
CREATE POLICY "Admins view contracts" ON public.contracts
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert contracts" ON public.contracts
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- ============ AUTO-PROFILE TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();