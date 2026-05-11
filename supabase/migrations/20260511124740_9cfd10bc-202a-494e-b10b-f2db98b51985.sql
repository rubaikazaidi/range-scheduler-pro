
DROP POLICY IF EXISTS "Authenticated can view branches" ON public.branches;
CREATE POLICY "Anyone can view branches" ON public.branches FOR SELECT TO anon, authenticated USING (true);
