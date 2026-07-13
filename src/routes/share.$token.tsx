import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getPublicProtocol } from "@/lib/sessions.functions";
import { Button } from "@/components/ui/button";
import { Gauge, Printer } from "lucide-react";

const protocolQuery = (token: string) =>
  queryOptions({ queryKey: ["public-protocol", token], queryFn: () => getPublicProtocol({ data: { token } }) });

export const Route = createFileRoute("/share/$token")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(protocolQuery(params.token)),
  component: PublicProtocol,
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Protocol unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

const GROUPS = ["A", "B", "C", "D", "BR", "STAB"] as const;

function classify(dev: number, tol: number): "ok" | "warn" | "bad" {
  const a = Math.abs(dev);
  if (a <= tol) return "ok";
  if (a <= tol * 2) return "warn";
  return "bad";
}

function PublicProtocol() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(protocolQuery(token));
  const { session, lines, measurements } = data;
  const wing = session.wing as {
    serial_number: string;
    owner_note: string | null;
    model: { brand: string; name: string; size: string | null; cells: number | null };
  };

  const measMap = new Map<string, number>();
  for (const m of measurements as { line_spec_id: string; measured_mm: number | string }[]) {
    measMap.set(m.line_spec_id, Number(m.measured_mm));
  }

  const rows = (lines as {
    id: string; line_group: string; label: string;
    factory_length_mm: number | string; tolerance_mm: number | string;
  }[]).map((l) => {
    const measured = measMap.get(l.id) ?? null;
    const factory = Number(l.factory_length_mm);
    const tol = Number(l.tolerance_mm) || 10;
    const dev = measured === null ? null : measured - factory;
    const cls = dev === null ? "empty" : classify(dev, tol);
    return { line: l, measured, factory, tol, dev, cls };
  });

  const measured = rows.filter((r) => r.dev !== null);
  const outOfTol = measured.filter((r) => r.cls !== "ok").length;
  const worst = measured.length ? Math.max(...measured.map((r) => Math.abs(r.dev ?? 0))) : 0;
  const avg = measured.length ? measured.reduce((s, r) => s + (r.dev ?? 0), 0) / measured.length : 0;

  return (
    <div className="min-h-screen bg-background text-foreground print:bg-white">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
      <header className="border-b border-border no-print">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Gauge className="h-5 w-5 text-primary" />
            Niviuk Measure — Protocol
          </div>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Measurement protocol</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {wing.model.brand} {wing.model.name}{wing.model.size ? ` · ${wing.model.size}` : ""}
          </h1>
          <div className="mt-1 text-sm text-muted-foreground font-mono">
            SN {wing.serial_number} · {session.session_date}
            {wing.model.cells ? ` · ${wing.model.cells} cells` : ""}
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Stat label="Lines measured" value={`${measured.length} / ${rows.length}`} />
          <Stat label="Out of tolerance" value={String(outOfTol)} tone={outOfTol === 0 ? "ok" : "bad"} />
          <Stat label="Worst deviation" value={measured.length ? `${worst.toFixed(1)} mm` : "—"} />
          <Stat label="Avg deviation" value={measured.length ? `${avg >= 0 ? "+" : ""}${avg.toFixed(1)} mm` : "—"} />
        </div>

        {GROUPS.map((g) => {
          const items = rows.filter((r) => r.line.line_group === g);
          if (items.length === 0) return null;
          return (
            <section key={g}>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">Group {g}</h2>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm font-mono">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Line</th>
                      <th className="text-right px-4 py-2 font-medium">Factory (mm)</th>
                      <th className="text-right px-4 py-2 font-medium">Measured (mm)</th>
                      <th className="text-right px-4 py-2 font-medium">Tol ±</th>
                      <th className="text-right px-4 py-2 font-medium">Deviation</th>
                      <th className="text-right px-4 py-2 font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={r.line.id} className="border-t border-border">
                        <td className="px-4 py-2 font-semibold text-primary">{r.line.label}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{r.factory.toFixed(0)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{r.measured?.toFixed(1) ?? "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.tol.toFixed(1)}</td>
                        <td className={`px-4 py-2 text-right tabular-nums ${
                          r.cls === "ok" ? "text-emerald-600" : r.cls === "warn" ? "text-amber-600" : r.cls === "bad" ? "text-red-600" : "text-muted-foreground"
                        }`}>
                          {r.dev === null ? "—" : `${r.dev >= 0 ? "+" : ""}${r.dev.toFixed(1)}`}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                          {r.dev === null ? "—" : `${((r.dev / r.factory) * 100).toFixed(2)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        {session.notes && (
          <div className="rounded-lg border border-border p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Technician notes</div>
            <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
          </div>
        )}

        <div className="pt-6 border-t border-border text-xs text-muted-foreground">
          Issued by Niviuk workshop · Protocol token {token.slice(0, 8)}…
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  const t = tone === "ok" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "";
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${t}`}>{value}</div>
    </div>
  );
}