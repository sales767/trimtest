import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWing, upsertWing, updateWingLoop } from "@/lib/wings.functions";
import { getSession } from "@/lib/sessions.functions";
import { PageHeader } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, GitCompare, AlertTriangle, Lock } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const wingQuery = (id: string) =>
  queryOptions({ queryKey: ["wing", id], queryFn: () => getWing({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/wings/$id/")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(wingQuery(params.id)),
  component: WingDetail,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Wing not found</div>,
});

const GROUPS = ["A", "B", "C", "D", "BR", "STAB"] as const;
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-foreground",
  complete: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  published: "bg-primary/15 text-primary",
};

function classify(dev: number, tol: number): "ok" | "warn" | "bad" {
  const a = Math.abs(dev);
  if (a <= tol) return "ok";
  if (a <= tol * 2) return "warn";
  return "bad";
}

function WingDetail() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(wingQuery(id));
  const wing = data.wing as {
    id: string;
    serial_number: string;
    owner_note: string | null;
    production_date: string | null;
    purchase_date: string | null;
    first_flight_date: string | null;
    wing_hours: number | null;
    line_set_hours: number | null;
    serial_checksum_valid: boolean | null;
    model_id: string;
    model: {
      id: string;
      brand: string;
      name: string;
      size: string | null;
      cells: number | null;
      safety_notice: string | null;
      brake_measurement_supported: boolean | null;
    };
  };
  const sessions = data.sessions;
  const lines = (data as { lines?: { id: string; label: string; line_group: string; material_id: string | null }[] }).lines ?? [];
  const loopState = (data as { wingLoopState?: { line_spec_id: string; loop_type_id: string | null }[] }).wingLoopState ?? [];
  const loopTypes = (data as { loopTypes?: { id: string; name: string }[] }).loopTypes ?? [];
  const qc = useQueryClient();

  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);

  const [meta, setMeta] = useState({
    production_date: wing.production_date ?? "",
    purchase_date: wing.purchase_date ?? "",
    first_flight_date: wing.first_flight_date ?? "",
    wing_hours: wing.wing_hours != null ? String(wing.wing_hours) : "",
    line_set_hours: wing.line_set_hours != null ? String(wing.line_set_hours) : "",
  });
  const metaMut = useMutation({
    mutationFn: () =>
      upsertWing({
        data: {
          id: wing.id,
          model_id: wing.model_id,
          serial_number: wing.serial_number,
          production_date: meta.production_date || null,
          purchase_date: meta.purchase_date || null,
          first_flight_date: meta.first_flight_date || null,
          wing_hours: meta.wing_hours ? Number(meta.wing_hours) : null,
          line_set_hours: meta.line_set_hours ? Number(meta.line_set_hours) : null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wing", id] });
      toast.success("Wing metadata saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loopMut = useMutation({
    mutationFn: (v: { line_spec_id: string; loop_type_id: string | null }) =>
      updateWingLoop({ data: { wing_id: wing.id, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wing", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const loopByLine = new Map(loopState.map((s) => [s.line_spec_id, s.loop_type_id]));

  return (
    <div>
      <PageHeader
        title={`${wing.model.brand} ${wing.model.name}${wing.model.size ? ` · ${wing.model.size}` : ""}`}
        description={`SN ${wing.serial_number} · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/wings"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
          </Button>
        }
      />

      <div className="p-8 space-y-8">
        {wing.model.safety_notice && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm flex gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-700 dark:text-amber-400">Model safety notice</div>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{wing.model.safety_notice}</p>
            </div>
          </div>
        )}

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">Wing metadata</h2>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <MetaField label="Production date" locked={Boolean(wing.production_date)}>
                <Input type="date" value={meta.production_date} disabled={Boolean(wing.production_date)} onChange={(e) => setMeta({ ...meta, production_date: e.target.value })} />
              </MetaField>
              <MetaField label="Purchase date" locked={Boolean(wing.purchase_date)}>
                <Input type="date" value={meta.purchase_date} disabled={Boolean(wing.purchase_date)} onChange={(e) => setMeta({ ...meta, purchase_date: e.target.value })} />
              </MetaField>
              <MetaField label="First flight" locked={Boolean(wing.first_flight_date)}>
                <Input type="date" value={meta.first_flight_date} disabled={Boolean(wing.first_flight_date)} onChange={(e) => setMeta({ ...meta, first_flight_date: e.target.value })} />
              </MetaField>
              <MetaField label="Wing hours">
                <Input type="number" step="0.1" value={meta.wing_hours} onChange={(e) => setMeta({ ...meta, wing_hours: e.target.value })} />
              </MetaField>
              <MetaField label="Line-set hours">
                <Input type="number" step="0.1" value={meta.line_set_hours} onChange={(e) => setMeta({ ...meta, line_set_hours: e.target.value })} />
              </MetaField>
              <div className="text-xs text-muted-foreground pt-6">
                Serial checksum:{" "}
                <span className={wing.serial_checksum_valid ? "text-emerald-600" : "text-amber-600"}>
                  {wing.serial_checksum_valid ? "valid" : "not validated"}
                </span>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={() => metaMut.mutate()} disabled={metaMut.isPending}>
                {metaMut.isPending ? "Saving…" : "Save metadata"}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Dates lock after first save; contact an admin to reopen.
            </p>
          </div>
        </section>

        {lines.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">Installed loops</h2>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Group</th>
                    <th className="text-left px-3 py-2 font-medium">Line</th>
                    <th className="text-left px-3 py-2 font-medium">Loop</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-3 py-2 text-muted-foreground">{l.line_group}</td>
                      <td className="px-3 py-2 font-mono">{l.label}</td>
                      <td className="px-3 py-2">
                        <select
                          className="rounded border border-input bg-background text-xs h-8 px-2"
                          value={loopByLine.get(l.id) ?? ""}
                          onChange={(e) =>
                            loopMut.mutate({ line_spec_id: l.id, loop_type_id: e.target.value || null })
                          }
                        >
                          <option value="">— none —</option>
                          {loopTypes.map((lt) => (
                            <option key={lt.id} value={lt.id}>{lt.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">History</h2>
          {sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
              No measurement sessions yet for this wing.
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="w-10"></th>
                    <th className="w-10"></th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Notes</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-2 text-center">
                        <input type="radio" name="a" checked={aId === s.id} onChange={() => setAId(s.id)} title="Set as A" />
                      </td>
                      <td className="px-2 text-center">
                        <input type="radio" name="b" checked={bId === s.id} onChange={() => setBId(s.id)} title="Set as B" />
                      </td>
                      <td className="px-4 py-3 font-mono">{s.session_date}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status] ?? ""}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-md">{s.notes ?? "—"}</td>
                      <td className="px-2 py-2 text-right">
                        <Link to="/sessions/$id" params={{ id: s.id }} className="inline-flex items-center text-primary hover:underline">
                          Open <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Compare pre / post
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Pick two sessions above (columns A and B) to see line-by-line deltas.
          </p>
          {aId && bId ? (
            <Compare aId={aId} bId={bId} />
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground text-sm inline-flex items-center gap-2">
              <GitCompare className="h-4 w-4" /> Select A and B in the history table.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MetaField({ label, locked, children }: { label: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="flex items-center gap-1">
        {label}
        {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
      </Label>
      {children}
    </div>
  );
}

function Compare({ aId, bId }: { aId: string; bId: string }) {
  const results = useQueries({
    queries: [
      { queryKey: ["session", aId], queryFn: () => getSession({ data: { id: aId } }) },
      { queryKey: ["session", bId], queryFn: () => getSession({ data: { id: bId } }) },
    ],
  });
  const [a, b] = results;

  const rows = useMemo(() => {
    if (!a.data || !b.data) return [];
    const lines = a.data.lines as {
      id: string; line_group: string; label: string; factory_length_mm: number | string; tolerance_mm: number | string;
    }[];
    const mapA = new Map<string, number>();
    const mapB = new Map<string, number>();
    for (const m of a.data.measurements as { line_spec_id: string; measured_mm: number | string }[]) mapA.set(m.line_spec_id, Number(m.measured_mm));
    for (const m of b.data.measurements as { line_spec_id: string; measured_mm: number | string }[]) mapB.set(m.line_spec_id, Number(m.measured_mm));
    return lines.map((l) => {
      const factory = Number(l.factory_length_mm);
      const tol = Number(l.tolerance_mm) || 10;
      const va = mapA.get(l.id) ?? null;
      const vb = mapB.get(l.id) ?? null;
      const devA = va === null ? null : va - factory;
      const devB = vb === null ? null : vb - factory;
      const delta = va !== null && vb !== null ? vb - va : null;
      return { l, factory, tol, va, vb, devA, devB, delta };
    });
  }, [a.data, b.data]);

  if (a.isLoading || b.isLoading) return <div className="p-6 text-muted-foreground text-sm">Loading…</div>;
  if (a.error || b.error) return <div className="p-6 text-destructive text-sm">{(a.error ?? b.error)?.message}</div>;
  if (!a.data || !b.data) return null;

  const dateA = a.data.session.session_date;
  const dateB = b.data.session.session_date;

  return (
    <div className="space-y-6">
      {GROUPS.map((g) => {
        const items = rows.filter((r) => r.l.line_group === g);
        if (items.length === 0) return null;
        return (
          <div key={g}>
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Group {g}</h3>
            <div className="rounded-lg border border-border overflow-hidden bg-card">
              <table className="w-full text-sm font-mono">
                <thead className="bg-muted/50 text-muted-foreground text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Line</th>
                    <th className="text-right px-3 py-2 font-medium">Factory</th>
                    <th className="text-right px-3 py-2 font-medium">A · {dateA}</th>
                    <th className="text-right px-3 py-2 font-medium">Dev A</th>
                    <th className="text-right px-3 py-2 font-medium">B · {dateB}</th>
                    <th className="text-right px-3 py-2 font-medium">Dev B</th>
                    <th className="text-right px-3 py-2 font-medium">Δ (B − A)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => {
                    const clsA = r.devA === null ? "empty" : classify(r.devA, r.tol);
                    const clsB = r.devB === null ? "empty" : classify(r.devB, r.tol);
                    const color = (c: string) =>
                      c === "ok" ? "text-emerald-600" : c === "warn" ? "text-amber-600" : c === "bad" ? "text-red-600" : "text-muted-foreground";
                    return (
                      <tr key={r.l.id} className="border-t border-border">
                        <td className="px-3 py-2 font-semibold text-primary">{r.l.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.factory.toFixed(0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.va?.toFixed(1) ?? "—"}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${color(clsA)}`}>
                          {r.devA === null ? "—" : `${r.devA >= 0 ? "+" : ""}${r.devA.toFixed(1)}`}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.vb?.toFixed(1) ?? "—"}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${color(clsB)}`}>
                          {r.devB === null ? "—" : `${r.devB >= 0 ? "+" : ""}${r.devB.toFixed(1)}`}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums font-semibold ${
                          r.delta === null ? "text-muted-foreground"
                          : Math.abs(r.delta) < 0.5 ? "text-muted-foreground"
                          : r.delta > 0 ? "text-amber-600" : "text-sky-600"
                        }`}>
                          {r.delta === null ? "—" : `${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(1)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}