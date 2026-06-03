CREATE TABLE public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  caller_name TEXT NOT NULL,
  caller_phone TEXT,
  facilities TEXT[] NOT NULL DEFAULT '{}',
  inquiry_types TEXT[] NOT NULL DEFAULT '{}',
  respondent_name TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view call logs" ON public.call_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert call logs" ON public.call_logs
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update call logs" ON public.call_logs
  FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Super admins delete call logs" ON public.call_logs
  FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE TRIGGER update_call_logs_updated_at
  BEFORE UPDATE ON public.call_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_call_logs_call_time ON public.call_logs(call_time DESC);
CREATE INDEX idx_call_logs_facilities ON public.call_logs USING GIN(facilities);
CREATE INDEX idx_call_logs_inquiry_types ON public.call_logs USING GIN(inquiry_types);