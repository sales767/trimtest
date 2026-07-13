import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueries } from "@tanstack/react-query";
import { getWing } from "@/lib/wings.functions";
import { getSession } from "@/lib/sessions.functions";
import { PageHeader } from "./route";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, GitCompare } from "lucide-react";
import { useState, useMemo } from "react";

const wingQuery = (id: string) =>
  queryOptions({ queryKey: ["wing", id], queryFn: () => getWing({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/wings/$id")({
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
    id: string; serial_number: string; owner_note: string | null;
    model: { id: string; brand: string; name: string; size: string | null; cells: number | null };
  };
  const sessions = data.sessions;

  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);

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