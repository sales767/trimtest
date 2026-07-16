import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listPublicFeed = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("measurement_sessions")
    .select(
      "id, session_date, share_token, publish_anonymously, wing:wings(serial_number, model:wing_models(brand, name, size))",
    )
    .eq("status", "published")
    .order("session_date", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => {
    const w = s.wing as { serial_number: string; model: { brand: string; name: string; size: string | null } } | null;
    return {
      id: s.id,
      session_date: s.session_date,
      share_token: s.share_token,
      anonymous: Boolean(s.publish_anonymously),
      serial: s.publish_anonymously ? null : w?.serial_number ?? null,
      model: w?.model ? `${w.model.brand} ${w.model.name}${w.model.size ? ` · ${w.model.size}` : ""}` : "—",
    };
  });
});

// (unused placeholder to keep tree-shaking friendly)
export const _keep = z;