
-- Create promotions storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('promotions', 'promotions', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Public read promotions images"
ON storage.objects FOR SELECT
USING (bucket_id = 'promotions');

-- Admins can upload
CREATE POLICY "Admins upload promotion images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'promotions' AND public.is_admin(auth.uid()));

-- Admins can update
CREATE POLICY "Admins update promotion images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'promotions' AND public.is_admin(auth.uid()));

-- Admins can delete
CREATE POLICY "Admins delete promotion images"
ON storage.objects FOR DELETE
USING (bucket_id = 'promotions' AND public.is_admin(auth.uid()));

-- Trigger to auto-create profile on signup (if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
