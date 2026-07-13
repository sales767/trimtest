import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles").select("user_id").eq("user_id", ctx.userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const listLoopCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [mats, loops, shorts] = await Promise.all([
      context.supabase.from("line_materials").select("*").order("name"),
      context.supabase.from("loop_types").select("*").order("sort_order").order("name"),
      context.supabase.from("loop_shortenings").select("*"),
    ]);
    if (mats.error) throw new Error(mats.error.message);
    if (loops.error) throw new Error(loops.error.message);
    if (shorts.error) throw new Error(shorts.error.message);
    return { materials: mats.data ?? [], loopTypes: loops.data ?? [], shortenings: shorts.data ?? [] };
  });

export const upsertMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => {
    const o = d as { id?: string; name: string; diameter_mm?: number | null; notes?: string | null };
    if (!o.name) throw new Error("Name required");
    return o;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = { name: data.name, diameter_mm: data.diameter_mm ?? null, notes: data.notes ?? null };
    const q = data.id
      ? context.supabase.from("line_materials").update(row).eq("id", data.id)
      : context.supabase.from("line_materials").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => {
    const o = d as { id: string };
    if (!o.id) throw new Error("id required");
    return o;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("line_materials").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertLoopType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => {
    const o = d as { id?: string; name: string; description?: string | null; sort_order?: number };
    if (!o.name) throw new Error("Name required");
    return o;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = { name: data.name, description: data.description ?? null, sort_order: data.sort_order ?? 0 };
    const q = data.id
      ? context.supabase.from("loop_types").update(row).eq("id", data.id)
      : context.supabase.from("loop_types").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLoopType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => {
    const o = d as { id: string };
    if (!o.id) throw new Error("id required");
    return o;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("loop_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setShortening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => {
    const o = d as { material_id: string; loop_type_id: string; shortening_mm: number | null };
    if (!o.material_id || !o.loop_type_id) throw new Error("material/loop required");
    return o;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.shortening_mm === null || Number.isNaN(data.shortening_mm)) {
      const { error } = await context.supabase
        .from("loop_shortenings")
        .delete()
        .eq("material_id", data.material_id)
        .eq("loop_type_id", data.loop_type_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("loop_shortenings")
        .upsert(
          { material_id: data.material_id, loop_type_id: data.loop_type_id, shortening_mm: data.shortening_mm },
          { onConflict: "material_id,loop_type_id" },
        );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });