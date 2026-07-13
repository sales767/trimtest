
-- ============ Enums ============
CREATE TYPE public.app_role AS ENUM ('admin', 'technician');
CREATE TYPE public.session_status AS ENUM ('draft', 'complete', 'published');
CREATE TYPE public.line_group AS ENUM ('A', 'B', 'C', 'D', 'BR', 'STAB');

-- ============ Timestamps helper ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ Profiles ============
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ User Roles ============
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ New user trigger: create profile + default technician role ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'technician');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ Wing Models ============
CREATE TABLE public.wing_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL DEFAULT 'Niviuk',
  name TEXT NOT NULL,
  size TEXT,
  cells INTEGER,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wing_models TO authenticated;
GRANT ALL ON public.wing_models TO service_role;
ALTER TABLE public.wing_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read wing_models" ON public.wing_models
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create wing_models" ON public.wing_models
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated update wing_models" ON public.wing_models
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete wing_models" ON public.wing_models
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER wing_models_updated_at BEFORE UPDATE ON public.wing_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Line Specs ============
CREATE TABLE public.line_specs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES public.wing_models(id) ON DELETE CASCADE,
  line_group line_group NOT NULL,
  row_index INTEGER NOT NULL DEFAULT 1,
  label TEXT NOT NULL,
  factory_length_mm NUMERIC(10,2) NOT NULL,
  tolerance_mm NUMERIC(10,2) NOT NULL DEFAULT 10,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, label)
);
CREATE INDEX line_specs_model_idx ON public.line_specs(model_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.line_specs TO authenticated;
GRANT ALL ON public.line_specs TO service_role;
ALTER TABLE public.line_specs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read line_specs" ON public.line_specs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write line_specs" ON public.line_specs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER line_specs_updated_at BEFORE UPDATE ON public.line_specs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Wings (physical units) ============
CREATE TABLE public.wings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES public.wing_models(id) ON DELETE RESTRICT,
  serial_number TEXT NOT NULL,
  owner_note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, serial_number)
);
CREATE INDEX wings_model_idx ON public.wings(model_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wings TO authenticated;
GRANT ALL ON public.wings TO service_role;
ALTER TABLE public.wings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read wings" ON public.wings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write wings" ON public.wings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER wings_updated_at BEFORE UPDATE ON public.wings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Measurement Sessions ============
CREATE TABLE public.measurement_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wing_id UUID NOT NULL REFERENCES public.wings(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status session_status NOT NULL DEFAULT 'draft',
  share_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  checksum TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (share_token)
);
CREATE INDEX ms_wing_idx ON public.measurement_sessions(wing_id);
CREATE INDEX ms_tech_idx ON public.measurement_sessions(technician_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_sessions TO authenticated;
GRANT SELECT ON public.measurement_sessions TO anon;
GRANT ALL ON public.measurement_sessions TO service_role;
ALTER TABLE public.measurement_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read sessions" ON public.measurement_sessions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon read published sessions" ON public.measurement_sessions
  FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "Technicians create own sessions" ON public.measurement_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = technician_id);
CREATE POLICY "Technicians update own drafts" ON public.measurement_sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = technician_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = technician_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Technicians delete own drafts" ON public.measurement_sessions
  FOR DELETE TO authenticated
  USING ((auth.uid() = technician_id AND status = 'draft') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER ms_updated_at BEFORE UPDATE ON public.measurement_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Measurements ============
CREATE TABLE public.measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.measurement_sessions(id) ON DELETE CASCADE,
  line_spec_id UUID NOT NULL REFERENCES public.line_specs(id) ON DELETE RESTRICT,
  measured_mm NUMERIC(10,2) NOT NULL,
  deviation_mm NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, line_spec_id)
);
CREATE INDEX m_session_idx ON public.measurements(session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurements TO authenticated;
GRANT SELECT ON public.measurements TO anon;
GRANT ALL ON public.measurements TO service_role;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read measurements" ON public.measurements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon read measurements of published sessions" ON public.measurements
  FOR SELECT TO anon USING (EXISTS (
    SELECT 1 FROM public.measurement_sessions s
    WHERE s.id = session_id AND s.status = 'published'
  ));
CREATE POLICY "Technicians write measurements in own drafts" ON public.measurements
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.measurement_sessions s
    WHERE s.id = session_id
      AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.measurement_sessions s
    WHERE s.id = session_id
      AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE TRIGGER m_updated_at BEFORE UPDATE ON public.measurements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-compute deviation on insert/update
CREATE OR REPLACE FUNCTION public.compute_measurement_deviation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  factory NUMERIC(10,2);
BEGIN
  SELECT factory_length_mm INTO factory FROM public.line_specs WHERE id = NEW.line_spec_id;
  NEW.deviation_mm = NEW.measured_mm - COALESCE(factory, 0);
  RETURN NEW;
END;
$$;
CREATE TRIGGER m_compute_deviation
  BEFORE INSERT OR UPDATE OF measured_mm, line_spec_id ON public.measurements
  FOR EACH ROW EXECUTE FUNCTION public.compute_measurement_deviation();
