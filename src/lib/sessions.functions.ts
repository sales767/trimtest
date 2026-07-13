import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("measurement_sessions")
      .select("id, session_date, status, notes, updated_at, wing:wings(id, serial_number, model:wing_models(brand, name, size))")
      .order("session_date", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ wing_id: z.string().uuid(), notes: z.string().max(2000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("measurement_sessions")
      .insert({ wing_id: data.wing_id, technician_id: context.userId, notes: data.notes ?? null })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: session, error } = await context.supabase
      .from("measurement_sessions")
      .select("*, wing:wings(id, serial_number, owner_note, model:wing_models(id, brand, name, size, cells))")
      .eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) throw new Error("Session not found");
    const modelId = (session.wing as { model: { id: string } }).model.id;
    const [linesRes, measRes] = await Promise.all([
      context.supabase.from("line_specs").select("*").eq("model_id", modelId).order("line_group").order("sort_order").order("label"),
      context.supabase.from("measurements").select("*").eq("session_id", data.id),
    ]);
    if (linesRes.error) throw new Error(linesRes.error.message);
    if (measRes.error) throw new Error(measRes.error.message);
    return { session, lines: linesRes.data ?? [], measurements: measRes.data ?? [] };
  });

export const upsertMeasurement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      session_id: z.string().uuid(),
      line_spec_id: z.string().uuid(),
      measured_mm: z.number().nonnegative().max(20000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("measurements")
      .upsert(
        { session_id: data.session_id, line_spec_id: data.line_spec_id, measured_mm: data.measured_mm },
        { onConflict: "session_id,line_spec_id" },
      )
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMeasurement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ session_id: z.string().uuid(), line_spec_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("measurements").delete()
      .eq("session_id", data.session_id).eq("line_spec_id", data.line_spec_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["draft", "complete", "published"]).optional(),
      notes: z.string().max(2000).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      status?: "draft" | "complete" | "published";
      notes?: string | null;
      share_token?: string;
    } = {};
    if (data.status) patch.status = data.status;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.status === "published") {
      const { data: existing } = await context.supabase
        .from("measurement_sessions")
        .select("share_token")
        .eq("id", data.id)
        .maybeSingle();
      if (!existing?.share_token) {
        const bytes = new Uint8Array(18);
        crypto.getRandomValues(bytes);
        patch.share_token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      }
    }
    const { data: row, error } = await context.supabase
      .from("measurement_sessions").update(patch).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("measurement_sessions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPublicProtocol = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(8).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session, error } = await supabaseAdmin
      .from("measurement_sessions")
      .select(
        "id, session_date, status, notes, share_token, wing:wings(serial_number, owner_note, model:wing_models(id, brand, name, size, cells))",
      )
      .eq("share_token", data.token)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) throw new Error("Protocol not found or not published");
    const modelId = (session.wing as { model: { id: string } }).model.id;
    const [lr, mr] = await Promise.all([
      supabaseAdmin.from("line_specs").select("*").eq("model_id", modelId).order("line_group").order("sort_order").order("label"),
      supabaseAdmin.from("measurements").select("*").eq("session_id", session.id),
    ]);
    if (lr.error) throw new Error(lr.error.message);
    if (mr.error) throw new Error(mr.error.message);
    return { session, lines: lr.data ?? [], measurements: mr.data ?? [] };
  });