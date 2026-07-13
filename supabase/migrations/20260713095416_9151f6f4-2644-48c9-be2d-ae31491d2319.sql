
-- 1) Move has_role out of public schema so PostgREST no longer exposes it
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
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

REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated;

-- 2) Drop policies that reference public.has_role so we can drop the function
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins delete wing_models" ON public.wing_models;
DROP POLICY IF EXISTS "Authenticated update wing_models" ON public.wing_models;
DROP POLICY IF EXISTS "wings delete" ON public.wings;
DROP POLICY IF EXISTS "wings insert" ON public.wings;
DROP POLICY IF EXISTS "wings update" ON public.wings;
DROP POLICY IF EXISTS "line_specs delete" ON public.line_specs;
DROP POLICY IF EXISTS "line_specs insert" ON public.line_specs;
DROP POLICY IF EXISTS "line_specs update" ON public.line_specs;
DROP POLICY IF EXISTS "Technicians update own drafts" ON public.measurement_sessions;
DROP POLICY IF EXISTS "Technicians delete own drafts" ON public.measurement_sessions;
DROP POLICY IF EXISTS "Technicians write measurements in own drafts" ON public.measurements;
DROP POLICY IF EXISTS "admin write materials" ON public.line_materials;
DROP POLICY IF EXISTS "admin write loop_types" ON public.loop_types;
DROP POLICY IF EXISTS "admin write loop_shortenings" ON public.loop_shortenings;
DROP POLICY IF EXISTS "Authenticated can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anon read published sessions" ON public.measurement_sessions;
DROP POLICY IF EXISTS "Anon read measurements of published sessions" ON public.measurements;

-- 3) Drop the public has_role function (moved to app_private)
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 4) Recreate policies using app_private.has_role

-- user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

-- profiles: owner or admin only
CREATE POLICY "Users read own profile or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR app_private.has_role(auth.uid(), 'admin'));

-- wing_models: update only by creator or admin; delete only by admin
CREATE POLICY "Authenticated update wing_models" ON public.wing_models
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete wing_models" ON public.wing_models
  FOR DELETE TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'));

-- wings: only owner or admin can modify/delete; insert must set created_by = auth.uid()
CREATE POLICY "wings insert" ON public.wings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "wings update" ON public.wings
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "wings delete" ON public.wings
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));

-- line_specs: admin only writes
CREATE POLICY "line_specs insert" ON public.line_specs
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "line_specs update" ON public.line_specs
  FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "line_specs delete" ON public.line_specs
  FOR DELETE TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'));

-- measurement_sessions technician policies
CREATE POLICY "Technicians update own drafts" ON public.measurement_sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = technician_id OR app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = technician_id OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Technicians delete own drafts" ON public.measurement_sessions
  FOR DELETE TO authenticated
  USING ((auth.uid() = technician_id AND status = 'draft') OR app_private.has_role(auth.uid(), 'admin'));

-- measurements technician policies
CREATE POLICY "Technicians write measurements in own drafts" ON public.measurements
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.measurement_sessions s
    WHERE s.id = measurements.session_id
      AND (s.technician_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.measurement_sessions s
    WHERE s.id = measurements.session_id
      AND (s.technician_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'))
  ));

-- materials/loops admin writes
CREATE POLICY "admin write materials" ON public.line_materials
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin write loop_types" ON public.loop_types
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin write loop_shortenings" ON public.loop_shortenings
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

-- Note: anon SELECT policies on measurement_sessions and measurements have been
-- dropped. Public shared-protocol pages continue to work because they read via
-- the server-side service-role client, which bypasses RLS.
