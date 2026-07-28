import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { listModels, upsertModel, deleteModel } from "@/lib/models.functions";
import { PageHeader } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const modelsQuery = queryOptions({
  queryKey: ["models"],
  queryFn: () => listModels(),
});

export const Route = createFileRoute("/_authenticated/models")({
  component: ModelsPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(modelsQuery),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function ModelsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(modelsQuery);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    brand: "Niviuk",
    name: "",
    size: "",
    cells: "",
    notes: "",
    safety_notice: "",
    brake_measurement_supported: true,
  });

  const createMut = useMutation({
    mutationFn: () =>
      upsertModel({
        data: {
          brand: form.brand,
          name: form.name,
          size: form.size || null,
          cells: form.cells ? Number(form.cells) : null,
          notes: form.notes || null,
          safety_notice: form.safety_notice || null,
          brake_measurement_supported: form.brake_measurement_supported,
        },
      }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["models"] });
      setOpen(false);
      setForm({ brand: "Niviuk", name: "", size: "", cells: "", notes: "", safety_notice: "", brake_measurement_supported: true });
      navigate({ to: "/models/$id", params: { id: (row as { id: string }).id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteModel({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["models"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Wing models"
        description="Factory database of every measurable wing model."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New model</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New wing model</DialogTitle></DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Brand</Label>
                    <Input required value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input required placeholder="Artik R" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Size</Label>
                    <Input placeholder="22" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
                  </div>
                  <div>
                    <Label>Cells</Label>
                    <Input type="number" value={form.cells} onChange={(e) => setForm({ ...form, cells: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <div>
                  <Label>Safety notice (optional)</Label>
                  <Textarea rows={2} placeholder="Shown as a banner on every wing of this model" value={form.safety_notice} onChange={(e) => setForm({ ...form, safety_notice: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.brake_measurement_supported} onChange={(e) => setForm({ ...form, brake_measurement_supported: e.target.checked })} />
                  Brake measurement supported
                </label>
                <DialogFooter>
                  <Button type="submit" disabled={createMut.isPending}>
                    {createMut.isPending ? "Creating…" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8">
        {data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">No wing models yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Create the first one to begin the factory database.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Brand</th>
                  <th className="text-left px-4 py-3 font-medium">Model</th>
                  <th className="text-left px-4 py-3 font-medium">Size</th>
                  <th className="text-left px-4 py-3 font-medium">Cells</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {data.map((m) => (
                  <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">{m.brand}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link to="/models/$id" params={{ id: m.id }} className="hover:text-primary">
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.size ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.cells ?? "—"}</td>
                    <td className="px-2 py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => {
                        if (confirm(`Delete ${m.name}? Linemaps will be removed too.`)) delMut.mutate(m.id);
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to="/models/$id" params={{ id: m.id }}>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}