import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Bulk import measurements from a client-parsed XLSX. Each row is
// { label, measured_mm }. Labels are matched against line_specs of the
// session's wing model. Returns per-row status.
const xlsxInput = z.object({
  session_id: z.string().uuid(),
  rows: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        measured_mm: z.number().nonnegative().max(20000),
      }),
    )
    .min(1)
    .max(1000),
});

export const importMeasurementsXlsx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => xlsxInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: session, error: se } = await context.supabase
      .from("measurement_sessions")
      .select("id, wing:wings(model_id)")
      .eq("id", data.session_id)
      .maybeSingle();
    if (se) throw new Error(se.message);
    if (!session) throw new Error("Session not found");
    const modelId = (session.wing as { model_id: string }).model_id;
    const { data: specs, error: le } = await context.supabase
      .from("line_specs")
      .select("id, label")
      .eq("model_id", modelId);
    if (le) throw new Error(le.message);
    const byLabel = new Map((specs ?? []).map((s) => [s.label.toLowerCase(), s.id]));
    const matched: { session_id: string; line_spec_id: string; measured_mm: number }[] = [];
    const skipped: { label: string; reason: string }[] = [];
    for (const r of data.rows) {
      const id = byLabel.get(r.label.toLowerCase());
      if (!id) {
        skipped.push({ label: r.label, reason: "label not in linemap" });
        continue;
      }
      matched.push({ session_id: data.session_id, line_spec_id: id, measured_mm: r.measured_mm });
    }
    if (matched.length > 0) {
      const { error } = await context.supabase
        .from("measurements")
        .upsert(matched, { onConflict: "session_id,line_spec_id" });
      if (error) throw new Error(error.message);
    }
    return { imported: matched.length, skipped };
  });

// Persist accepted loop changes for a session, optionally sync them to
// the wing's current loop state, and set session status/comment.
const finishInput = z.object({
  session_id: z.string().uuid(),
  comment: z.string().max(2000).optional().nullable(),
  publish_anonymously: z.boolean().optional(),
  changes: z
    .array(
      z.object({
        line_spec_id: z.string().uuid(),
        previous_loop_type_id: z.string().uuid().nullable().optional(),
        new_loop_type_id: z.string().uuid().nullable().optional(),
        applied: z.boolean().default(false),
      }),
    )
    .default([]),
  cascades: z
    .array(
      z.object({
        line_group: z.enum(["A", "B", "C", "D", "BR", "STAB"]),
        description: z.string().min(1).max(2000),
      }),
    )
    .default([]),
  inserts: z
    .array(
      z.object({
        line_spec_id: z.string().uuid().nullable().optional(),
        description: z.string().min(1).max(2000),
        length_change_mm: z.number().min(-500).max(500),
      }),
    )
    .default([]),
  sync_wing_loop_state: z.boolean().default(false),
  publish: z.boolean().default(false),
});

export const finishSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => finishInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: session, error: se } = await context.supabase
      .from("measurement_sessions")
      .select("id, wing_id")
      .eq("id", data.session_id)
      .maybeSingle();
    if (se) throw new Error(se.message);
    if (!session) throw new Error("Session not found");

    // 1) Write loop change records
    if (data.changes.length > 0) {
      const rows = data.changes.map((c) => ({
        session_id: data.session_id,
        line_spec_id: c.line_spec_id,
        previous_loop_type_id: c.previous_loop_type_id ?? null,
        new_loop_type_id: c.new_loop_type_id ?? null,
        applied: c.applied ?? false,
      }));
      // Clean prior draft entries for the same lines
      const lineIds = rows.map((r) => r.line_spec_id);
      const { error: de } = await context.supabase
        .from("session_loop_changes")
        .delete()
        .eq("session_id", data.session_id)
        .in("line_spec_id", lineIds);
      if (de) throw new Error(de.message);
      const { error: ie } = await context.supabase.from("session_loop_changes").insert(rows);
      if (ie) throw new Error(ie.message);
    }

    // 2) Sync wing_loop_state with applied changes
    if (data.sync_wing_loop_state) {
      const applied = data.changes.filter((c) => c.applied);
      if (applied.length > 0) {
        const state = applied.map((c) => ({
          wing_id: session.wing_id,
          line_spec_id: c.line_spec_id,
          loop_type_id: c.new_loop_type_id ?? null,
          updated_by: context.userId,
        }));
        const { error } = await context.supabase
          .from("wing_loop_state")
          .upsert(state, { onConflict: "wing_id,line_spec_id" });
        if (error) throw new Error(error.message);
      }
    }

    // 2b) Cascade descriptions + insert records (replace all for the session)
    {
      const { error: dc } = await context.supabase
        .from("cascade_loop_changes")
        .delete()
        .eq("session_id", data.session_id);
      if (dc) throw new Error(dc.message);
      if (data.cascades.length > 0) {
        const rows = data.cascades.map((c) => ({
          session_id: data.session_id,
          line_group: c.line_group,
          description: c.description,
        }));
        const { error: ic } = await context.supabase.from("cascade_loop_changes").insert(rows);
        if (ic) throw new Error(ic.message);
      }
      const { error: di } = await context.supabase
        .from("line_inserts")
        .delete()
        .eq("session_id", data.session_id);
      if (di) throw new Error(di.message);
      if (data.inserts.length > 0) {
        const rows = data.inserts.map((r) => ({
          session_id: data.session_id,
          line_spec_id: r.line_spec_id ?? null,
          description: r.description,
          length_change_mm: r.length_change_mm,
        }));
        const { error: ii } = await context.supabase.from("line_inserts").insert(rows);
        if (ii) throw new Error(ii.message);
      }
    }

    // 3) Update session status/comment
    const patch: {
      comment?: string | null;
      publish_anonymously?: boolean;
      status?: "draft" | "complete" | "published";
      share_token?: string;
    } = {};
    if (data.comment !== undefined) patch.comment = data.comment;
    if (data.publish_anonymously !== undefined) patch.publish_anonymously = data.publish_anonymously;
    if (data.publish) {
      patch.status = "published";
      const { data: existing } = await context.supabase
        .from("measurement_sessions")
        .select("share_token")
        .eq("id", data.session_id)
        .maybeSingle();
      if (!existing?.share_token) {
        const bytes = new Uint8Array(18);
        crypto.getRandomValues(bytes);
        patch.share_token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      }
    } else {
      patch.status = "complete";
    }
    const { error: ue } = await context.supabase
      .from("measurement_sessions")
      .update(patch)
      .eq("id", data.session_id);
    if (ue) throw new Error(ue.message);
    return { ok: true };
  });

// Update session setup fields separately (from the setup panel)
const setupInput = z.object({
  id: z.string().uuid(),
  measurement_order: z.enum(["rows", "columns", "sections"]).optional(),
  includes_brakes: z.boolean().optional(),
  tolerance_override_mm: z.number().min(0).max(500).nullable().optional(),
  offset_mm: z.number().min(-500).max(500).nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
  publish_anonymously: z.boolean().optional(),
});

export const updateSessionSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => setupInput.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("measurement_sessions")
      .update(rest)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Read cascades, inserts and loop-change records for a session.
export const getSessionExtras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [c, i, lc] = await Promise.all([
      context.supabase.from("cascade_loop_changes").select("*").eq("session_id", data.session_id),
      context.supabase.from("line_inserts").select("*").eq("session_id", data.session_id),
      context.supabase.from("session_loop_changes").select("*").eq("session_id", data.session_id),
    ]);
    if (c.error) throw new Error(c.error.message);
    if (i.error) throw new Error(i.error.message);
    if (lc.error) throw new Error(lc.error.message);
    return { cascades: c.data ?? [], inserts: i.data ?? [], loopChanges: lc.data ?? [] };
  });

// Create a re-measure session as a child of an existing session. Optionally
// copies measured values for lines NOT selected for re-measurement.
const remeasureInput = z.object({
  previous_session_id: z.string().uuid(),
  remeasure_line_ids: z.array(z.string().uuid()).default([]),
  carry_over: z.boolean().default(true),
  notes: z.string().max(2000).optional().nullable(),
});

export const createRemeasureSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => remeasureInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: prev, error: pe } = await context.supabase
      .from("measurement_sessions")
      .select(
        "wing_id, notes, measurement_order, includes_brakes, tolerance_override_mm, offset_mm, publish_anonymously",
      )
      .eq("id", data.previous_session_id)
      .maybeSingle();
    if (pe) throw new Error(pe.message);
    if (!prev) throw new Error("Previous session not found");
    const { data: created, error: ce } = await context.supabase
      .from("measurement_sessions")
      .insert({
        wing_id: prev.wing_id,
        technician_id: context.userId,
        notes: data.notes ?? prev.notes ?? null,
        measurement_order: prev.measurement_order,
        includes_brakes: prev.includes_brakes,
        tolerance_override_mm: prev.tolerance_override_mm,
        offset_mm: prev.offset_mm,
        publish_anonymously: prev.publish_anonymously,
        previous_session_id: data.previous_session_id,
      })
      .select("id")
      .single();
    if (ce) throw new Error(ce.message);
    if (data.carry_over) {
      const remeasure = new Set(data.remeasure_line_ids);
      const { data: prevMeasurements, error: me } = await context.supabase
        .from("measurements")
        .select("line_spec_id, measured_mm")
        .eq("session_id", data.previous_session_id);
      if (me) throw new Error(me.message);
      const toCopy = (prevMeasurements ?? []).filter((m) => !remeasure.has(m.line_spec_id));
      if (toCopy.length > 0) {
        const rows = toCopy.map((m) => ({
          session_id: created.id,
          line_spec_id: m.line_spec_id,
          measured_mm: m.measured_mm,
        }));
        const { error: ie } = await context.supabase.from("measurements").insert(rows);
        if (ie) throw new Error(ie.message);
      }
    }
    return { session_id: created.id };
  });