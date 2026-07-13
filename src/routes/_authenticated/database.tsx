import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listAllSessions } from "@/lib/sessions.functions";
import { PageHeader } from "./route";
import { ArrowRight, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const dbQuery = queryOptions({ queryKey: ["all-sessions"], queryFn: () => listAllSessions() });

export const Route = createFileRoute("/_authenticated/database")({
  component: DatabasePage,
  loader: ({ context }) => context.queryClient.ensureQueryData(dbQuery),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-foreground",
  complete: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  published: "bg-primary/15 text-primary",
};

type Row = Awaited<ReturnType<typeof listAllSessions>>[number];

function DatabasePage() {
  const { data } = useSuspenseQuery(dbQuery);
  const [q, setQ] = useState("");
  const [modelId, setModelId] = useState<string>("");
  const [techId, setTechId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const models = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const s of data) {
      const m = (s.wing as { model: { id: string; brand: string; name: string; size: string | null } } | null)?.model;
      if (m && !map.has(m.id)) map.set(m.id, { id: m.id, label: `${m.brand} ${m.name}${m.size ? ` · ${m.size}` : ""}` });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  const techs = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const s of data) {
      const t = s.technician;
      const id = s.technician_id;
      if (id && !map.has(id)) map.set(id, { id, label: t?.full_name || t?.email || id.slice(0, 8) });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.filter((s: Row) => {
      const wing = s.wing as { serial_number: string; model: { id: string; brand: string; name: string; size: string | null } } | null;
      if (modelId && wing?.model.id !== modelId) return false;
      if (techId && s.technician_id !== techId) return false;
      if (status && s.status !== status) return false;
      if (from && s.session_date < from) return false;
      if (to && s.session_date > to) return false;
      if (term) {
        const hay = [
          wing?.serial_number,
          wing?.model.brand,
          wing?.model.name,
          wing?.model.size,
          s.technician?.full_name,
          s.technician?.email,
          s.notes,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [data, q, modelId, techId, status, from, to]);

  function exportCsv() {
    const header = ["date", "wing_serial", "brand", "model", "size", "technician", "email", "status", "measurements", "notes"];
    const rows = filtered.map((s) => {
      const w = s.wing as { serial_number: string; model: { brand: string; name: string; size: string | null } } | null;
      return [
        s.session_date,
        w?.serial_number ?? "",
        w?.model.brand ?? "",
        w?.model.name ?? "",
        w?.model.size ?? "",
        s.technician?.full_name ?? "",
        s.technician?.email ?? "",
        s.status,
        String(s.measurement_count),
        (s.notes ?? "").replace(/\s+/g, " "),
      ];
    });
    const csv = [header, ...rows]
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

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const s of filtered) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    const totalMeasurements = filtered.reduce((n, s) => n + s.measurement_count, 0);
    return { totalMeasurements, byStatus };
  }, [filtered]);

  return (
    <div>
      <PageHeader
        title="Database"
        description="Full internal archive of measurement sessions across all technicians and models."
        action={
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        }
      />
      <div className="p-8 space-y-6">
        <div className="grid gap-3 md:grid-cols-6 rounded-lg border border-border bg-card p-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search serial, model, technician, notes…"
              className="pl-9"
            />
          </div>
          <select
            className="rounded-md border border-input bg-background px-3 h-9 text-sm"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
          >
            <option value="">All models</option>
            {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 h-9 text-sm"
            value={techId}
            onChange={(e) => setTechId(e.target.value)}
          >
            <option value="">All technicians</option>
            {techs.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 h-9 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
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
            <div>
              <span className="font-medium text-foreground">{filtered.length}</span> sessions ·{" "}
              <span className="font-medium text-foreground">{stats.totalMeasurements}</span> measurements
              {Object.entries(stats.byStatus).map(([k, v]) => (
                <span key={k} className="ml-3">{k}: <span className="text-foreground">{v}</span></span>
              ))}
            </div>
            <button className="underline hover:text-foreground" onClick={reset}>Reset filters</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            No sessions match the current filters.
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Wing</th>
                  <th className="text-left px-4 py-3 font-medium">Model</th>
                  <th className="text-left px-4 py-3 font-medium">Technician</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Lines</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const wing = s.wing as { id: string; serial_number: string; model: { brand: string; name: string; size: string | null } } | null;
                  return (
                    <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3">{s.session_date}</td>
                      <td className="px-4 py-3 font-mono">
                        {wing ? (
                          <Link to="/wings/$id" params={{ id: wing.id }} className="hover:underline">
                            {wing.serial_number}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {wing?.model ? `${wing.model.brand} ${wing.model.name}${wing.model.size ? ` · ${wing.model.size}` : ""}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.technician?.full_name || s.technician?.email || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status] ?? ""}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.measurement_count}</td>
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
      </div>
    </div>
  );
}