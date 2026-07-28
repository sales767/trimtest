import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listSessions, listAllSessions, startMeasurement } from "@/lib/sessions.functions";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import { listModels } from "@/lib/models.functions";
import { getMyProfile } from "@/lib/profile.functions";
import { PageHeader } from "./route";
import { ArrowRight, Download, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const meAdminQuery = queryOptions({ queryKey: ["is-admin"], queryFn: () => isCurrentUserAdmin() });
const mySessionsQuery = queryOptions({ queryKey: ["sessions"], queryFn: () => listSessions() });
const allSessionsQuery = queryOptions({ queryKey: ["all-sessions"], queryFn: () => listAllSessions() });
const modelsQuery = queryOptions({ queryKey: ["models"], queryFn: () => listModels() });
const meProfileQuery = queryOptions({ queryKey: ["my-profile"], queryFn: () => getMyProfile() });

export const Route = createFileRoute("/_authenticated/sessions/")({
  component: SessionsPage,
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meAdminQuery);
    await Promise.all([
      context.queryClient.ensureQueryData(modelsQuery),
      context.queryClient.ensureQueryData(meProfileQuery),
      me.isAdmin
        ? context.queryClient.ensureQueryData(allSessionsQuery)
        : context.queryClient.ensureQueryData(mySessionsQuery),
    ]);
  },
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-foreground",
  complete: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  published: "bg-primary/15 text-primary",
};

type AdminRow = Awaited<ReturnType<typeof listAllSessions>>[number];
type MineRow = Awaited<ReturnType<typeof listSessions>>[number];

function SessionsPage() {
  const { data: me } = useSuspenseQuery(meAdminQuery);
  const isAdmin = Boolean(me.isAdmin);
  const { data: models } = useSuspenseQuery(modelsQuery);
  const { data: profile } = useSuspenseQuery(meProfileQuery);
  const activeQuery = (isAdmin ? allSessionsQuery : mySessionsQuery) as typeof allSessionsQuery;
  const { data: rowsData } = useSuspenseQuery(activeQuery);
  const rows = (rowsData ?? []) as unknown as (AdminRow | MineRow)[];
  const adminData = isAdmin ? ((rowsData ?? []) as unknown as AdminRow[]) : undefined;

  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    model_id: string;
    serial_number: string;
    notes: string;
    measurement_order: "rows" | "columns" | "sections";
    includes_brakes: boolean;
    tolerance_override_mm: string;
    offset_mm: string;
    publish_anonymously: boolean;
  }>({
    model_id: "",
    serial_number: "",
    notes: "",
    measurement_order: (profile.preferred_measurement_order ?? "rows") as "rows" | "columns" | "sections",
    includes_brakes: false,
    tolerance_override_mm: "",
    offset_mm: profile.laser_offset_mm ? String(profile.laser_offset_mm) : "",
    publish_anonymously: false,
  });

  const start = useMutation({
    mutationFn: () =>
      startMeasurement({
        data: {
          model_id: form.model_id,
          serial_number: form.serial_number,
          notes: form.notes || undefined,
          measurement_order: form.measurement_order,
          includes_brakes: form.includes_brakes,
          tolerance_override_mm: form.tolerance_override_mm.trim() ? Number(form.tolerance_override_mm) : null,
          offset_mm: form.offset_mm.trim() ? Number(form.offset_mm) : null,
          publish_anonymously: form.publish_anonymously,
        },
      }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["all-sessions"] });
      qc.invalidateQueries({ queryKey: ["wings"] });
      setOpen(false);
      setForm((f) => ({ ...f, model_id: "", serial_number: "", notes: "" }));
      navigate({ to: "/sessions/$id", params: { id: (row as { session_id: string }).session_id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Filters (admin only)
  const [q, setQ] = useState("");
  const [modelId, setModelId] = useState("");
  const [techId, setTechId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const modelOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const m = (r.wing as { model: { id?: string; brand: string; name: string; size: string | null } } | null)?.model;
      const id = m && "id" in m ? m.id : undefined;
      if (id && m && !map.has(id)) map.set(id, `${m.brand} ${m.name}${m.size ? ` · ${m.size}` : ""}`);
    }
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const techOptions = useMemo(() => {
    if (!isAdmin) return [];
    const map = new Map<string, string>();
    for (const r of adminData ?? []) {
      const id = r.technician_id;
      if (id && !map.has(id)) map.set(id, r.technician?.full_name || r.technician?.email || id.slice(0, 8));
    }
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [adminData, isAdmin]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((s) => {
      const wing = s.wing as { serial_number: string; model: { id?: string; brand: string; name: string; size: string | null } } | null;
      if (modelId && wing?.model && "id" in wing.model && wing.model.id !== modelId) return false;
      if (isAdmin && techId && (s as AdminRow).technician_id !== techId) return false;
      if (status && s.status !== status) return false;
      if (from && s.session_date < from) return false;
      if (to && s.session_date > to) return false;
      if (term) {
        const tech = (s as AdminRow).technician;
        const hay = [
          wing?.serial_number,
          wing?.model.brand,
          wing?.model.name,
          wing?.model.size,
          tech?.full_name,
          tech?.email,
          s.notes,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, modelId, techId, status, from, to, isAdmin]);

  function exportCsv() {
    const header = ["date", "wing_serial", "brand", "model", "size", "technician", "email", "status", "notes"];
    const csv = [
      header,
      ...filtered.map((s) => {
        const w = s.wing as { serial_number: string; model: { brand: string; name: string; size: string | null } } | null;
        const tech = (s as AdminRow).technician;
        return [
          s.session_date,
          w?.serial_number ?? "",
          w?.model.brand ?? "",
          w?.model.name ?? "",
          w?.model.size ?? "",
          tech?.full_name ?? "",
          tech?.email ?? "",
          s.status,
          (s.notes ?? "").replace(/\s+/g, " "),
        ];
      }),
    ]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `niviuk-measurements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setQ(""); setModelId(""); setTechId(""); setStatus(""); setFrom(""); setTo("");
  }

  return (
    <div>
      <PageHeader
        title="Measurements"
        description={isAdmin ? "All measurement sessions across technicians." : "Your measurement sessions."}
        action={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button disabled={models.length === 0}>
                  <Plus className="h-4 w-4 mr-2" /> New measurement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New measurement</DialogTitle></DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!form.model_id || !form.serial_number.trim()) return;
                    start.mutate();
                  }}
                >
                  <div>
                    <Label>Wing model</Label>
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
                    <Input
                      required
                      placeholder="ART-R22-2025-0142"
                      value={form.serial_number}
                      onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      If a wing with this serial already exists it will be reused.
                    </p>
                  </div>
                  <div>
                    <Label>Notes (optional)</Label>
                    <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Measurement order</Label>
                      <Select
                        value={form.measurement_order}
                        onValueChange={(v) => setForm({ ...form, measurement_order: v as "rows" | "columns" | "sections" })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rows">Rows</SelectItem>
                          <SelectItem value="columns">Columns</SelectItem>
                          <SelectItem value="sections">Sections</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Laser offset (mm)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={form.offset_mm}
                        onChange={(e) => setForm({ ...form, offset_mm: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label>Tolerance override (mm)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={form.tolerance_override_mm}
                        onChange={(e) => setForm({ ...form, tolerance_override_mm: e.target.value })}
                        placeholder="use line spec"
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.includes_brakes}
                          onChange={(e) => setForm({ ...form, includes_brakes: e.target.checked })}
                        />
                        Include brakes
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.publish_anonymously}
                          onChange={(e) => setForm({ ...form, publish_anonymously: e.target.checked })}
                        />
                        Publish anonymously
                      </label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={start.isPending || !form.model_id || !form.serial_number.trim()}>
                      {start.isPending ? "Starting…" : "Start measuring"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <div className="p-8 space-y-6">
        {isAdmin && (
          <div className="grid gap-3 md:grid-cols-6 rounded-lg border border-border bg-card p-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search serial, model, technician, notes…" className="pl-9" />
            </div>
            <select className="rounded-md border border-input bg-background px-3 h-9 text-sm" value={modelId} onChange={(e) => setModelId(e.target.value)}>
              <option value="">All models</option>
              {modelOptions.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <select className="rounded-md border border-input bg-background px-3 h-9 text-sm" value={techId} onChange={(e) => setTechId(e.target.value)}>
              <option value="">All technicians</option>
              {techOptions.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <select className="rounded-md border border-input bg-background px-3 h-9 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="complete">Complete</option>
              <option value="published">Published</option>
            </select>
            <div className="flex gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="md:col-span-6 flex items-center justify-between text-xs text-muted-foreground">
              <span><span className="font-medium text-foreground">{filtered.length}</span> sessions</span>
              <button className="underline hover:text-foreground" onClick={reset}>Reset filters</button>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            {rows.length === 0
              ? "No measurements yet. Press New measurement to start."
              : "No sessions match the current filters."}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Wing</th>
                  <th className="text-left px-4 py-3 font-medium">Model</th>
                  {isAdmin && <th className="text-left px-4 py-3 font-medium">Technician</th>}
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const wing = s.wing as { serial_number: string; model: { brand: string; name: string; size: string | null } } | null;
                  const tech = (s as AdminRow).technician;
                  return (
                    <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3">{s.session_date}</td>
                      <td className="px-4 py-3 font-mono">{wing?.serial_number ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {wing?.model ? `${wing.model.brand} ${wing.model.name}${wing.model.size ? ` · ${wing.model.size}` : ""}` : "—"}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-muted-foreground">
                          {tech?.full_name || tech?.email || "—"}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status] ?? ""}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Link to="/sessions/$id" params={{ id: s.id }} className="inline-flex items-center text-primary hover:underline">
                          Open <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {models.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Create a <Link to="/models" className="underline">wing model</Link> first (with factory lengths per line) before starting a measurement.
          </p>
        )}
      </div>
    </div>
  );
}