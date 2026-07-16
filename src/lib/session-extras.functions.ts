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