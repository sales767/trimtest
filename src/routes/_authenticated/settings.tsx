import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { PageHeader } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const meQuery = queryOptions({ queryKey: ["my-profile"], queryFn: () => getMyProfile() });

export const Route = createFileRoute("/_authenticated/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: SettingsPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(meQuery);
  const [form, setForm] = useState({
    full_name: data.full_name ?? "",
    laser_offset_mm: String(data.laser_offset_mm ?? 0),
    preferred_measurement_order: (data.preferred_measurement_order ?? "rows") as "rows" | "columns" | "sections",
    default_tolerance_mm: String(data.default_tolerance_mm ?? 10),
  });
  useEffect(() => {
    setForm({
      full_name: data.full_name ?? "",
      laser_offset_mm: String(data.laser_offset_mm ?? 0),
      preferred_measurement_order: (data.preferred_measurement_order ?? "rows") as "rows" | "columns" | "sections",
      default_tolerance_mm: String(data.default_tolerance_mm ?? 10),
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      updateMyProfile({
        data: {
          full_name: form.full_name.trim() || undefined,
          laser_offset_mm: Number(form.laser_offset_mm) || 0,
          preferred_measurement_order: form.preferred_measurement_order,
          default_tolerance_mm: Number(form.default_tolerance_mm) || 10,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Settings" description="Personal defaults for measurement sessions." />
      <div className="p-8 max-w-2xl">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div>
            <Label>Display name</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Your name" />
            <p className="text-xs text-muted-foreground mt-1">{data.email}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Laser offset (mm)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.laser_offset_mm}
                onChange={(e) => setForm({ ...form, laser_offset_mm: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Subtracted from each raw reading. Calibrate against a known length.
              </p>
            </div>
            <div>
              <Label>Default tolerance (mm)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.default_tolerance_mm}
                onChange={(e) => setForm({ ...form, default_tolerance_mm: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Used when a line has no tolerance set and the session has no override.
              </p>
            </div>
          </div>
          <div>
            <Label>Preferred measurement order</Label>
            <Select
              value={form.preferred_measurement_order}
              onValueChange={(v) => setForm({ ...form, preferred_measurement_order: v as "rows" | "columns" | "sections" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rows">Rows — finish a full row before moving on</SelectItem>
                <SelectItem value="columns">Columns — a1, b1, c1, d1 then a2, b2…</SelectItem>
                <SelectItem value="sections">Sections — group by main line attachment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save settings"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}