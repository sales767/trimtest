import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listWings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("wings")
      .select("id, serial_number, owner_note, updated_at, model:wing_models(id, brand, name, size)")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getWing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: wing, error } = await context.supabase
      .from("wings")
      .select("*, model:wing_models(id, brand, name, size, cells)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!wing) throw new Error("Wing not found");
    const { data: sessions, error: se } = await context.supabase
      .from("measurement_sessions")
      .select("id, session_date, status, notes, updated_at")
      .eq("wing_id", data.id)
      .order("session_date", { ascending: false });
    if (se) throw new Error(se.message);
    return { wing, sessions: sessions ?? [] };
  });

const wingInput = z.object({
  id: z.string().uuid().optional(),
  model_id: z.string().uuid(),
  serial_number: z.string().min(1).max(80),
  owner_note: z.string().max(500).optional().nullable(),
  production_date: z.string().date().nullable().optional(),
  purchase_date: z.string().date().nullable().optional(),
  first_flight_date: z.string().date().nullable().optional(),
  wing_hours: z.number().min(0).max(100000).nullable().optional(),
  line_set_hours: z.number().min(0).max(100000).nullable().optional(),
});

export const upsertWing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => wingInput.parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...patch } = data;
      const { data: row, error } = await context.supabase
        .from("wings")
        .update(patch)
        .eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("wings")
      .insert({ ...data, created_by: context.userId })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

// Set/clear the current installed loop for a wing line, outside a session.
export const updateWingLoop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      wing_id: z.string().uuid(),
      line_spec_id: z.string().uuid(),
      loop_type_id: z.string().uuid().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.loop_type_id === null) {
      const { error } = await context.supabase
        .from("wing_loop_state")
        .delete()
        .eq("wing_id", data.wing_id)
        .eq("line_spec_id", data.line_spec_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase
      .from("wing_loop_state")
      .upsert(
        {
          wing_id: data.wing_id,
          line_spec_id: data.line_spec_id,
          loop_type_id: data.loop_type_id,
          updated_by: context.userId,
        },
        { onConflict: "wing_id,line_spec_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("wings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });