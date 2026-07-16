
-- ============ helper role function ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
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

-- ============ enums ============
CREATE TYPE public.line_side AS ENUM ('left', 'right', 'center');
CREATE TYPE public.measurement_order AS ENUM ('rows', 'columns', 'sections');

-- ============ line_specs: side + point_index ============
ALTER TABLE public.line_specs
  ADD COLUMN side public.line_side,
  ADD COLUMN point_index integer;

-- ============ wings: metadata + read-once ============
ALTER TABLE public.wings
  ADD COLUMN production_date date,
  ADD COLUMN purchase_date date,
  ADD COLUMN first_flight_date date,
  ADD COLUMN wing_hours numeric(10,2),
  ADD COLUMN line_set_hours numeric(10,2),
  ADD COLUMN serial_checksum_valid boolean NOT NULL DEFAULT false;

-- trigger: compute serial_checksum_valid + enforce read-once for populated fields
CREATE OR REPLACE FUNCTION public.wings_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  digits text;
  sum_val int := 0;
  ch text;
  i int;
BEGIN
  -- serial checksum: sum of digit characters mod 10 == 0 => valid
  digits := regexp_replace(COALESCE(NEW.serial_number, ''), '\D', '', 'g');
  IF length(digits) >= 4 AND NEW.production_date IS NOT NULL THEN
    FOR i IN 1..length(digits) LOOP
      ch := substr(digits, i, 1);
      sum_val := sum_val + ch::int;
    END LOOP;
    NEW.serial_checksum_valid := (sum_val % 10 = 0);
  ELSE
    NEW.serial_checksum_valid := false;
  END IF;

  -- Read-once: once set, forbid changes to these fields (admin override via has_role)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.production_date IS NOT NULL AND NEW.production_date IS DISTINCT FROM OLD.production_date
       AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'production_date is locked once set';
    END IF;
    IF OLD.purchase_date IS NOT NULL AND NEW.purchase_date IS DISTINCT FROM OLD.purchase_date
       AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'purchase_date is locked once set';
    END IF;
    IF OLD.first_flight_date IS NOT NULL AND NEW.first_flight_date IS DISTINCT FROM OLD.first_flight_date
       AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'first_flight_date is locked once set';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER wings_before_write
  BEFORE INSERT OR UPDATE ON public.wings
  FOR EACH ROW EXECUTE FUNCTION public.wings_before_write();

-- ============ wing_models: brake support + safety notice ============
ALTER TABLE public.wing_models
  ADD COLUMN brake_measurement_supported boolean NOT NULL DEFAULT false,
  ADD COLUMN safety_notice text;

-- ============ measurements: flags ============
ALTER TABLE public.measurements
  ADD COLUMN flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN flag_reason text;

-- ============ measurement_sessions: setup + chain ============
ALTER TABLE public.measurement_sessions
  ADD COLUMN measurement_order public.measurement_order NOT NULL DEFAULT 'rows',
  ADD COLUMN includes_brakes boolean NOT NULL DEFAULT false,
  ADD COLUMN tolerance_override_mm numeric(10,2),
  ADD COLUMN offset_mm numeric(10,2),
  ADD COLUMN comment text,
  ADD COLUMN publish_anonymously boolean NOT NULL DEFAULT false,
  ADD COLUMN previous_session_id uuid REFERENCES public.measurement_sessions(id) ON DELETE SET NULL;

-- ============ profiles: user setup defaults ============
ALTER TABLE public.profiles
  ADD COLUMN laser_offset_mm numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN preferred_measurement_order public.measurement_order NOT NULL DEFAULT 'rows',
  ADD COLUMN default_tolerance_mm numeric(10,2) NOT NULL DEFAULT 10;

-- ============ wing_loop_state ============
CREATE TABLE public.wing_loop_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wing_id uuid NOT NULL REFERENCES public.wings(id) ON DELETE CASCADE,
  line_spec_id uuid NOT NULL REFERENCES public.line_specs(id) ON DELETE CASCADE,
  loop_type_id uuid REFERENCES public.loop_types(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wing_id, line_spec_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wing_loop_state TO authenticated;
GRANT ALL ON public.wing_loop_state TO service_role;
ALTER TABLE public.wing_loop_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wls authenticated read" ON public.wing_loop_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "wls authenticated write" ON public.wing_loop_state FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "wls authenticated update" ON public.wing_loop_state FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "wls admin delete" ON public.wing_loop_state FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER wls_updated_at BEFORE UPDATE ON public.wing_loop_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ session_loop_changes ============
CREATE TABLE public.session_loop_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.measurement_sessions(id) ON DELETE CASCADE,
  line_spec_id uuid NOT NULL REFERENCES public.line_specs(id) ON DELETE CASCADE,
  previous_loop_type_id uuid REFERENCES public.loop_types(id) ON DELETE SET NULL,
  new_loop_type_id uuid REFERENCES public.loop_types(id) ON DELETE SET NULL,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_loop_changes TO authenticated;
GRANT ALL ON public.session_loop_changes TO service_role;
GRANT SELECT ON public.session_loop_changes TO anon;
ALTER TABLE public.session_loop_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slc technician all" ON public.session_loop_changes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.measurement_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.measurement_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "slc anon published read" ON public.session_loop_changes FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.measurement_sessions s WHERE s.id = session_id AND s.status = 'published'));
CREATE TRIGGER slc_updated_at BEFORE UPDATE ON public.session_loop_changes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ line_inserts ============
CREATE TABLE public.line_inserts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.measurement_sessions(id) ON DELETE CASCADE,
  line_spec_id uuid REFERENCES public.line_specs(id) ON DELETE SET NULL,
  description text NOT NULL,
  length_change_mm numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.line_inserts TO authenticated;
GRANT ALL ON public.line_inserts TO service_role;
GRANT SELECT ON public.line_inserts TO anon;
ALTER TABLE public.line_inserts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "li technician all" ON public.line_inserts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.measurement_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.measurement_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "li anon published read" ON public.line_inserts FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.measurement_sessions s WHERE s.id = session_id AND s.status = 'published'));
CREATE TRIGGER li_updated_at BEFORE UPDATE ON public.line_inserts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ cascade_loop_changes ============
CREATE TABLE public.cascade_loop_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.measurement_sessions(id) ON DELETE CASCADE,
  line_group line_group NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cascade_loop_changes TO authenticated;
GRANT ALL ON public.cascade_loop_changes TO service_role;
GRANT SELECT ON public.cascade_loop_changes TO anon;
ALTER TABLE public.cascade_loop_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clc technician all" ON public.cascade_loop_changes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.measurement_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.measurement_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "clc anon published read" ON public.cascade_loop_changes FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.measurement_sessions s WHERE s.id = session_id AND s.status = 'published'));
CREATE TRIGGER clc_updated_at BEFORE UPDATE ON public.cascade_loop_changes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
