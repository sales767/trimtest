-- 1. Move remaining dependents of public.has_role to the private version
CREATE OR REPLACE FUNCTION public.wings_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  digits text;
  sum_val int := 0;
  ch text;
  i int;
BEGIN
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

  IF TG_OP = 'UPDATE' THEN
    IF OLD.production_date IS NOT NULL AND NEW.production_date IS DISTINCT FROM OLD.production_date
       AND NOT app_private.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'production_date is locked once set';
    END IF;
    IF OLD.purchase_date IS NOT NULL AND NEW.purchase_date IS DISTINCT FROM OLD.purchase_date
       AND NOT app_private.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'purchase_date is locked once set';
    END IF;
    IF OLD.first_flight_date IS NOT NULL AND NEW.first_flight_date IS DISTINCT FROM OLD.first_flight_date
       AND NOT app_private.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'first_flight_date is locked once set';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "wls admin delete" ON public.wing_loop_state;
CREATE POLICY "wls admin delete"
ON public.wing_loop_state FOR DELETE TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "slc technician all" ON public.session_loop_changes;
CREATE POLICY "slc technician all"
ON public.session_loop_changes FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.measurement_sessions s
  WHERE s.id = session_loop_changes.session_id
    AND (s.technician_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.measurement_sessions s
  WHERE s.id = session_loop_changes.session_id
    AND (s.technician_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'))
));

DROP POLICY IF EXISTS "li technician all" ON public.line_inserts;
CREATE POLICY "li technician all"
ON public.line_inserts FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.measurement_sessions s
  WHERE s.id = line_inserts.session_id
    AND (s.technician_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.measurement_sessions s
  WHERE s.id = line_inserts.session_id
    AND (s.technician_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'))
));

DROP POLICY IF EXISTS "clc technician all" ON public.cascade_loop_changes;
CREATE POLICY "clc technician all"
ON public.cascade_loop_changes FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.measurement_sessions s
  WHERE s.id = cascade_loop_changes.session_id
    AND (s.technician_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.measurement_sessions s
  WHERE s.id = cascade_loop_changes.session_id
    AND (s.technician_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'))
));

DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- 2. measurement_sessions: owner / admin / published only
DROP POLICY IF EXISTS "Authenticated read sessions" ON public.measurement_sessions;
CREATE POLICY "Read own, admin or published sessions"
ON public.measurement_sessions FOR SELECT TO authenticated
USING (
  technician_id = auth.uid()
  OR status = 'published'::session_status
  OR app_private.has_role(auth.uid(), 'admin')
);

-- 3. measurements: scoped through their session
DROP POLICY IF EXISTS "Authenticated read measurements" ON public.measurements;
CREATE POLICY "Read measurements of own, admin or published sessions"
ON public.measurements FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.measurement_sessions s
    WHERE s.id = measurements.session_id
      AND (
        s.technician_id = auth.uid()
        OR s.status = 'published'::session_status
        OR app_private.has_role(auth.uid(), 'admin')
      )
  )
);

-- 4. wings: creator / admin / measured by me / has published protocol
DROP POLICY IF EXISTS "Authenticated read wings" ON public.wings;
CREATE POLICY "Read own, measured, admin or published wings"
ON public.wings FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR app_private.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.measurement_sessions s
    WHERE s.wing_id = wings.id
      AND (s.technician_id = auth.uid() OR s.status = 'published'::session_status)
  )
);

-- 5. line_specs: staff-only reference data
DROP POLICY IF EXISTS "Authenticated read line_specs" ON public.line_specs;
CREATE POLICY "Staff read line_specs"
ON public.line_specs FOR SELECT TO authenticated
USING (
  app_private.has_role(auth.uid(), 'admin')
  OR app_private.has_role(auth.uid(), 'technician')
);