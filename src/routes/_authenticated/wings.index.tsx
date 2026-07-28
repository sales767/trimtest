import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { listWings, upsertWing, deleteWing } from "@/lib/wings.functions";
import { listModels } from "@/lib/models.functions";
import { createSession } from "@/lib/sessions.functions";
import { PageHeader } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Ruler, ArrowRight, History } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const wingsQuery = queryOptions({ queryKey: ["wings"], queryFn: () => listWings() });
const modelsForNew = queryOptions({ queryKey: ["models"], queryFn: () => listModels() });

export const Route = createFileRoute("/_authenticated/wings/")({
  component: WingsPage,
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(wingsQuery),
      context.queryClient.ensureQueryData(modelsForNew),
    ]),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function WingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: wings } = useSuspenseQuery(wingsQuery);
  const { data: models } = useSuspenseQuery(modelsForNew);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ model_id: "", serial_number: "", owner_note: "" });

  const createMut = useMutation({
    mutationFn: () =>
      upsertWing({
        data: { model_id: form.model_id, serial_number: form.serial_number, owner_note: form.owner_note || null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wings"] });
      setOpen(false);
      setForm({ model_id: "", serial_number: "", owner_note: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteWing({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wings"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const startSession = useMutation({
    mutationFn: (wing_id: string) => createSession({ data: { wing_id } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      navigate({ to: "/sessions/$id", params: { id: (row as { id: string }).id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Wings"
        description="Physical wings registered by serial number."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={models.length === 0}>
                <Plus className="h-4 w-4 mr-2" />Register wing
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Register a new wing</DialogTitle></DialogHeader>
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}>
                <div>
                  <Label>Model</Label>
                  <Select value={form.model_id} onValueChange={(v) => setForm({ ...form, model_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick a factory model" /></SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.brand} {m.name}{m.size ? ` · ${m.size}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Serial number</Label>
                  <Input required placeholder="ART-R22-2025-0142" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
                </div>
                <div>
                  <Label>Note</Label>
                  <Textarea rows={2} value={form.owner_note} onChange={(e) => setForm({ ...form, owner_note: e.target.value })} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMut.isPending || !form.model_id}>
                    {createMut.isPending ? "Saving…" : "Register"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8">
        {wings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">No wings registered yet.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Serial</th>
                  <th className="text-left px-4 py-3 font-medium">Model</th>
                  <th className="text-left px-4 py-3 font-medium">Note</th>
                  <th className="w-40"></th>
                </tr>
              </thead>
              <tbody>
                {wings.map((w) => {
                  const model = w.model as { brand: string; name: string; size: string | null } | null;
                  return (
                    <tr key={w.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono">{w.serial_number}</td>
                      <td className="px-4 py-3">{model ? `${model.brand} ${model.name}${model.size ? ` · ${model.size}` : ""}` : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">{w.owner_note ?? "—"}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to="/wings/$id" params={{ id: w.id }}>
                            <History className="h-3.5 w-3.5 mr-1" /> History
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => startSession.mutate(w.id)} disabled={startSession.isPending}>
                          <Ruler className="h-3.5 w-3.5 mr-1" /> Measure
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete wing ${w.serial_number}? Sessions will be removed.`)) delMut.mutate(w.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {models.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Create a <Link to="/models" className="underline">wing model</Link> first before registering a wing.
          </p>
        )}
      </div>
    </div>
  );
}