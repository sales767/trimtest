import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { getModel, upsertLine, deleteLine, bulkImportLines } from "@/lib/models.functions";
import { PageHeader } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Upload, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const modelQuery = (id: string) =>
  queryOptions({ queryKey: ["model", id], queryFn: () => getModel({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/models/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(modelQuery(params.id)),
  component: ModelDetail,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Model not found</div>,
});

const GROUPS = ["A", "B", "C", "D", "BR", "STAB"] as const;
type Group = (typeof GROUPS)[number];

function ModelDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(modelQuery(id));
  const { model, lines } = data;

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [line, setLine] = useState<{ line_group: Group; label: string; factory_length_mm: string; tolerance_mm: string; row_index: string }>({
    line_group: "A",
    label: "",
    factory_length_mm: "",
    tolerance_mm: "10",
    row_index: "1",
  });
  const [csv, setCsv] = useState("");
  const [replace, setReplace] = useState(false);

  const addLine = useMutation({
    mutationFn: () =>
      upsertLine({
        data: {
          model_id: id,
          line_group: line.line_group,
          label: line.label,
          factory_length_mm: Number(line.factory_length_mm),
          tolerance_mm: Number(line.tolerance_mm) || 10,
          row_index: Number(line.row_index) || 1,
          sort_order: lines.length,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["model", id] });
      setAddOpen(false);
      setLine({ ...line, label: "", factory_length_mm: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeLine = useMutation({
    mutationFn: (lineId: string) => deleteLine({ data: { id: lineId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const importCsv = useMutation({
    mutationFn: () => {
      const rows = parseCsv(csv);
      if (rows.length === 0) throw new Error("No valid rows found in CSV");
      return bulkImportLines({ data: { model_id: id, replace, lines: rows } });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["model", id] });
      setImportOpen(false);
      setCsv("");
      toast.success(`Imported ${r.count} lines`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = GROUPS.map((g) => ({
    group: g,
    items: lines.filter((l) => l.line_group === g),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <PageHeader
        title={`${model.brand} ${model.name}${model.size ? ` · ${model.size}` : ""}`}
        description={`Factory linemap · ${lines.length} lines${model.cells ? ` · ${model.cells} cells` : ""}`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild size="sm">
              <Link to="/models"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
            </Button>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><Upload className="h-4 w-4 mr-2" />Import CSV</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Import linemap from CSV</DialogTitle>
                  <DialogDescription>
                    One line per row. Columns: <code>group,label,factory_length_mm,tolerance_mm</code>.
                    Header row optional. Example: <code>A,A1,6820,10</code>
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  rows={10}
                  className="font-mono text-xs"
                  placeholder={"group,label,factory_length_mm,tolerance_mm\nA,A1,6820,10\nA,A2,6795,10\nB,B1,6650,10"}
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                  Replace existing linemap
                </label>
                <DialogFooter>
                  <Button onClick={() => importCsv.mutate()} disabled={importCsv.isPending}>
                    {importCsv.isPending ? "Importing…" : "Import"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add line</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add line spec</DialogTitle></DialogHeader>
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); addLine.mutate(); }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Group</Label>
                      <Select value={line.line_group} onValueChange={(v) => setLine({ ...line, line_group: v as Group })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Label</Label>
                      <Input required placeholder="A1" value={line.label} onChange={(e) => setLine({ ...line, label: e.target.value })} />
                    </div>
                    <div>
                      <Label>Factory length (mm)</Label>
                      <Input required type="number" step="0.01" value={line.factory_length_mm} onChange={(e) => setLine({ ...line, factory_length_mm: e.target.value })} />
                    </div>
                    <div>
                      <Label>Tolerance (± mm)</Label>
                      <Input type="number" step="0.1" value={line.tolerance_mm} onChange={(e) => setLine({ ...line, tolerance_mm: e.target.value })} />
                    </div>
                    <div>
                      <Label>Row</Label>
                      <Input type="number" value={line.row_index} onChange={(e) => setLine({ ...line, row_index: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={addLine.isPending}>{addLine.isPending ? "Saving…" : "Save"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        {grouped.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">No line specs yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Add lines manually or import a CSV to build the linemap.</p>
          </div>
        ) : (
          grouped.map((g) => (
            <section key={g.group}>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Group {g.group}
              </h2>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {g.items.map((l) => (
                  <div key={l.id} className="rounded-md border border-border bg-card p-3 relative group" style={{ boxShadow: "var(--shadow-panel)" }}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-primary">{l.label}</span>
                      <button
                        onClick={() => { if (confirm(`Delete ${l.label}?`)) removeLine.mutate(l.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 font-mono text-2xl tabular-nums">
                      {Number(l.factory_length_mm).toFixed(0)}
                      <span className="text-xs text-muted-foreground ml-1">mm</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      ± {Number(l.tolerance_mm).toFixed(1)} mm
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function parseCsv(text: string): Array<{
  line_group: Group;
  label: string;
  factory_length_mm: number;
  tolerance_mm: number;
  row_index: number;
  sort_order: number;
}> {
  const rows: ReturnType<typeof parseCsv> = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let order = 0;
  for (const raw of lines) {
    const parts = raw.split(/[,;\t]/).map((s) => s.trim());
    if (parts.length < 3) continue;
    const [g, label, len, tol] = parts;
    if (!GROUPS.includes(g as Group)) continue;
    const length = Number(len);
    if (!Number.isFinite(length) || length <= 0) continue;
    rows.push({
      line_group: g as Group,
      label,
      factory_length_mm: length,
      tolerance_mm: Number(tol) || 10,
      row_index: 1,
      sort_order: order++,
    });
  }
  return rows;
}