import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  listLoopCatalog,
  upsertMaterial,
  deleteMaterial,
  upsertLoopType,
  deleteLoopType,
  setShortening,
} from "@/lib/materials.functions";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import { PageHeader } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

const catalogQuery = queryOptions({ queryKey: ["loop-catalog"], queryFn: () => listLoopCatalog() });
const meAdminQuery = queryOptions({ queryKey: ["is-admin"], queryFn: () => isCurrentUserAdmin() });

export const Route = createFileRoute("/_authenticated/materials")({
  component: MaterialsPage,
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meAdminQuery);
    if (!me.isAdmin) throw new Error("Forbidden: admin only");
    await context.queryClient.ensureQueryData(catalogQuery);
  },
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function MaterialsPage() {
  const { data } = useSuspenseQuery(catalogQuery);
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["loop-catalog"] });

  const shortMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data.shortenings) m.set(`${s.material_id}:${s.loop_type_id}`, Number(s.shortening_mm));
    return m;
  }, [data.shortenings]);

  const mUpsert = useMutation({
    mutationFn: (v: Parameters<typeof upsertMaterial>[0]["data"]) => upsertMaterial({ data: v }),
    onSuccess: () => { invalidate(); toast.success("Material saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => deleteMaterial({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Material removed"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const lUpsert = useMutation({
    mutationFn: (v: Parameters<typeof upsertLoopType>[0]["data"]) => upsertLoopType({ data: v }),
    onSuccess: () => { invalidate(); toast.success("Loop type saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const lDelete = useMutation({
    mutationFn: (id: string) => deleteLoopType({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Loop type removed"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const sSet = useMutation({
    mutationFn: (v: { material_id: string; loop_type_id: string; shortening_mm: number | null }) =>
      setShortening({ data: v }),
    onSuccess: () => { invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newMat, setNewMat] = useState({ name: "", diameter_mm: "", notes: "" });
  const [newLoop, setNewLoop] = useState({ name: "", description: "", sort_order: "" });

  return (
    <div>
      <PageHeader
        title="Materials & loops"
        description="Reference database. Each cell tells how many mm a loop subtracts from a suspente's total length for that material."
      />
      <div className="p-8 space-y-8">
        {/* Loop types */}
        <section className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Loop types</h2>
          </div>
          <div className="p-4 space-y-2">
            {data.loopTypes.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <Input
                  defaultValue={l.name}
                  className="max-w-[220px]"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== l.name) lUpsert.mutate({ id: l.id, name: v, description: l.description, sort_order: l.sort_order });
                  }}
                />
                <Input
                  defaultValue={l.description ?? ""}
                  placeholder="Description"
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== (l.description ?? "")) lUpsert.mutate({ id: l.id, name: l.name, description: v, sort_order: l.sort_order });
                  }}
                />
                <Input
                  type="number"
                  defaultValue={l.sort_order}
                  className="max-w-[90px]"
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v !== l.sort_order) lUpsert.mutate({ id: l.id, name: l.name, description: l.description, sort_order: v });
                  }}
                />
                <Button variant="ghost" size="icon" onClick={() => lDelete.mutate(l.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Input placeholder="New loop type name" value={newLoop.name} onChange={(e) => setNewLoop({ ...newLoop, name: e.target.value })} className="max-w-[220px]" />
              <Input placeholder="Description" value={newLoop.description} onChange={(e) => setNewLoop({ ...newLoop, description: e.target.value })} />
              <Input type="number" placeholder="Order" value={newLoop.sort_order} onChange={(e) => setNewLoop({ ...newLoop, sort_order: e.target.value })} className="max-w-[90px]" />
              <Button
                onClick={() => {
                  if (!newLoop.name.trim()) return;
                  lUpsert.mutate({
                    name: newLoop.name.trim(),
                    description: newLoop.description || null,
                    sort_order: Number(newLoop.sort_order) || 0,
                  });
                  setNewLoop({ name: "", description: "", sort_order: "" });
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </div>
        </section>

        {/* Materials + matrix */}
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Materials × loop shortening (mm)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Material</th>
                  <th className="text-left px-3 py-2 font-medium">Ø mm</th>
                  <th className="text-left px-3 py-2 font-medium">Notes</th>
                  {data.loopTypes.map((l) => (
                    <th key={l.id} className="text-left px-3 py-2 font-medium whitespace-nowrap">{l.name}</th>
                  ))}
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.materials.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Input
                        defaultValue={m.name}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== m.name) mUpsert.mutate({ id: m.id, name: v, diameter_mm: m.diameter_mm, notes: m.notes });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={m.diameter_mm ?? ""}
                        className="max-w-[90px]"
                        onBlur={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          if (v !== m.diameter_mm) mUpsert.mutate({ id: m.id, name: m.name, diameter_mm: v, notes: m.notes });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        defaultValue={m.notes ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v !== (m.notes ?? "")) mUpsert.mutate({ id: m.id, name: m.name, diameter_mm: m.diameter_mm, notes: v });
                        }}
                      />
                    </td>
                    {data.loopTypes.map((l) => {
                      const key = `${m.id}:${l.id}`;
                      const val = shortMap.get(key);
                      return (
                        <td key={l.id} className="px-3 py-2">
                          <Input
                            type="number"
                            step="0.1"
                            defaultValue={val ?? ""}
                            className="max-w-[90px]"
                            onBlur={(e) => {
                              const raw = e.target.value;
                              const num = raw === "" ? null : Number(raw);
                              if ((num ?? null) !== (val ?? null)) {
                                sSet.mutate({ material_id: m.id, loop_type_id: l.id, shortening_mm: num });
                              }
                            }}
                          />
                        </td>
                      );
                    })}
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="icon" onClick={() => mDelete.mutate(m.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-border flex flex-wrap items-center gap-2">
            <Input placeholder="New material name" value={newMat.name} onChange={(e) => setNewMat({ ...newMat, name: e.target.value })} className="max-w-[280px]" />
            <Input type="number" step="0.01" placeholder="Ø mm" value={newMat.diameter_mm} onChange={(e) => setNewMat({ ...newMat, diameter_mm: e.target.value })} className="max-w-[110px]" />
            <Input placeholder="Notes" value={newMat.notes} onChange={(e) => setNewMat({ ...newMat, notes: e.target.value })} />
            <Button
              onClick={() => {
                if (!newMat.name.trim()) return;
                mUpsert.mutate({
                  name: newMat.name.trim(),
                  diameter_mm: newMat.diameter_mm === "" ? null : Number(newMat.diameter_mm),
                  notes: newMat.notes || null,
                });
                setNewMat({ name: "", diameter_mm: "", notes: "" });
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add material
            </Button>
            <div className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
              <Save className="h-3 w-3" /> Changes save automatically on blur.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}