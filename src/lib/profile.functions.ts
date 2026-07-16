import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(
        "id, email, full_name, laser_offset_mm, preferred_measurement_order, default_tolerance_mm",
      )
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Profile not found");
    return data;
  });

const profileInput = z.object({
  full_name: z.string().trim().max(120).optional(),
  laser_offset_mm: z.number().min(-500).max(500),
  preferred_measurement_order: z.enum(["rows", "columns", "sections"]),
  default_tolerance_mm: z.number().min(0).max(500),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => profileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("profiles")
      .update({
        full_name: data.full_name ?? undefined,
        laser_offset_mm: data.laser_offset_mm,
        preferred_measurement_order: data.preferred_measurement_order,
        default_tolerance_mm: data.default_tolerance_mm,
      })
      .eq("id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });