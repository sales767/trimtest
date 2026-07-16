import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listModels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("wing_models")
      .select("id, brand, name, size, cells, notes, updated_at")
      .order("brand")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getModel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: model, error } = await context.supabase
      .from("wing_models")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!model) throw new Error("Model not found");
    const { data: lines, error: le } = await context.supabase
      .from("line_specs")
      .select("*")
      .eq("model_id", data.id)
      .order("line_group")
      .order("sort_order")
      .order("label");
    if (le) throw new Error(le.message);
    return { model, lines: lines ?? [] };
  });

const modelInput = z.object({
  id: z.string().uuid().optional(),
  brand: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  size: z.string().max(40).optional().nullable(),
  cells: z.number().int().positive().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  brake_measurement_supported: z.boolean().optional(),
  safety_notice: z.string().max(2000).optional().nullable(),
});

export const upsertModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => modelInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = { ...data, created_by: context.userId };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("wing_models")
        .update({
          brand: data.brand,
          name: data.name,
          size: data.size,
          cells: data.cells,
          notes: data.notes,
          brake_measurement_supported: data.brake_measurement_supported,
          safety_notice: data.safety_notice,
        })
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("wing_models")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("wing_models").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const lineGroup = z.enum(["A", "B", "C", "D", "BR", "STAB"]);

const lineInput = z.object({
  id: z.string().uuid().optional(),
  model_id: z.string().uuid(),
  line_group: lineGroup,
  row_index: z.number().int().min(1).max(20).default(1),
  label: z.string().min(1).max(20),
  factory_length_mm: z.number().positive().max(20000),
  tolerance_mm: z.number().min(0).max(500).default(10),
  sort_order: z.number().int().min(0).max(1000).default(0),
  material_id: z.string().uuid().nullable().optional(),
});

export const upsertLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => lineInput.parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("line_specs")
        .update(data)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("line_specs")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("line_specs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const bulkLinesInput = z.object({
  model_id: z.string().uuid(),
  replace: z.boolean().default(false),
  lines: z.array(
    z.object({
      line_group: lineGroup,
      row_index: z.number().int().min(1).max(20).default(1),
      label: z.string().min(1).max(20),
      factory_length_mm: z.number().positive().max(20000),
      tolerance_mm: z.number().min(0).max(500).default(10),
      sort_order: z.number().int().min(0).max(1000).default(0),
    }),
  ).min(1).max(500),
});

export const bulkImportLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => bulkLinesInput.parse(d))
  .handler(async ({ data, context }) => {
    if (data.replace) {
      const { error } = await context.supabase
        .from("line_specs")
        .delete()
        .eq("model_id", data.model_id);
      if (error) throw new Error(error.message);
    }
    const rows = data.lines.map((l) => ({ ...l, model_id: data.model_id }));
    const { data: inserted, error } = await context.supabase
      .from("line_specs")
      .upsert(rows, { onConflict: "model_id,label" })
      .select();
    if (error) throw new Error(error.message);
    return { count: inserted?.length ?? 0 };
  });