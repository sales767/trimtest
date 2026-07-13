
-- Tighten permissive policies (require real authenticated uid)
DROP POLICY IF EXISTS "Authenticated update wing_models" ON public.wing_models;
CREATE POLICY "Authenticated update wing_models" ON public.wing_models
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated write line_specs" ON public.line_specs;
CREATE POLICY "line_specs insert" ON public.line_specs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "line_specs update" ON public.line_specs
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "line_specs delete" ON public.line_specs
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated write wings" ON public.wings;
CREATE POLICY "wings insert" ON public.wings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "wings update" ON public.wings
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "wings delete" ON public.wings
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL OR public.has_role(auth.uid(), 'admin'));

-- Revoke public execute on security-definer functions
REVOKE ALL ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_measurement_deviation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
