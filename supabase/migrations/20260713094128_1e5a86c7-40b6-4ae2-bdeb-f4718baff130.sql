
-- Materials
CREATE TABLE public.line_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  diameter_mm NUMERIC(6,3),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.line_materials TO authenticated;
GRANT ALL ON public.line_materials TO service_role;
ALTER TABLE public.line_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read materials" ON public.line_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write materials" ON public.line_materials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_line_materials_updated BEFORE UPDATE ON public.line_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Loop types
CREATE TABLE public.loop_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loop_types TO authenticated;
GRANT ALL ON public.loop_types TO service_role;
ALTER TABLE public.loop_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read loop_types" ON public.loop_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write loop_types" ON public.loop_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_loop_types_updated BEFORE UPDATE ON public.loop_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Shortening matrix
CREATE TABLE public.loop_shortenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.line_materials(id) ON DELETE CASCADE,
  loop_type_id UUID NOT NULL REFERENCES public.loop_types(id) ON DELETE CASCADE,
  shortening_mm NUMERIC(6,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (material_id, loop_type_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loop_shortenings TO authenticated;
GRANT ALL ON public.loop_shortenings TO service_role;
ALTER TABLE public.loop_shortenings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read loop_shortenings" ON public.loop_shortenings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write loop_shortenings" ON public.loop_shortenings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_loop_shortenings_updated BEFORE UPDATE ON public.loop_shortenings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link material to each spec line (optional)
ALTER TABLE public.line_specs
  ADD COLUMN material_id UUID REFERENCES public.line_materials(id) ON DELETE SET NULL;
