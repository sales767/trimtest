import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    return { isAdmin: Boolean(data) };
  });

async function assertAdmin(context: { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const listTechnicians = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profRes, rolesRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email, full_name, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    if (profRes.error) throw new Error(profRes.error.message);
    if (rolesRes.error) throw new Error(rolesRes.error.message);
    const roles = new Map<string, string[]>();
    for (const r of rolesRes.data ?? []) {
      const list = roles.get(r.user_id) ?? [];
      list.push(r.role);
      roles.set(r.user_id, list);
    }
    return (profRes.data ?? []).map((p) => ({ ...p, roles: roles.get(p.id) ?? [] }));
  });

export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => {
    const o = d as { user_id?: unknown; is_admin?: unknown };
    if (typeof o.user_id !== "string" || typeof o.is_admin !== "boolean") throw new Error("Invalid input");
    return { user_id: o.user_id, is_admin: o.is_admin };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.user_id === context.userId && !data.is_admin) {
      throw new Error("You cannot remove your own admin role");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.is_admin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.user_id, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });