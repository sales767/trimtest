import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { getSession, upsertMeasurement, updateSession, deleteSession } from "@/lib/sessions.functions";
import { importMeasurementsXlsx } from "@/lib/session-extras.functions";
import { PageHeader } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Trash2, Share2, Copy, Printer, ExternalLink, Upload, AlertTriangle, FileSpreadsheet, Radio, Crosshair } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { AoIDiagram, EstimatesDisclaimer } from "@/components/aoi-diagram";
import { exportProtocolPdf, exportProtocolXlsx } from "@/lib/session-export";
import { isLaserSupported, isLaserConnected, connectLaser, disconnectLaser, readNextDistanceMm } from "@/lib/leica-disto";

const sessionQuery = (id: string) =>
  queryOptions({ queryKey: ["session", id], queryFn: () => getSession({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/sessions/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(sessionQuery(params.id)),
  component: SessionDetail,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Session not found</div>,
});

const GROUPS = ["A", "B", "C", "D", "BR", "STAB"] as const;

type LineSpec = {
  id: string;
  line_group: string;
  label: string;
  factory_length_mm: number | string;
  tolerance_mm: number | string;
  material_id: string | null;
};
type Measurement = { line_spec_id: string; measured_mm: number | string; deviation_mm: number | string | null };
type MeasurementFull = Measurement & { flagged?: boolean | null; flag_reason?: string | null };
type Material = { id: string; name: string; diameter_mm: number | string | null };
type LoopType = { id: string; name: string; description: string | null; sort_order: number };
type Shortening = { material_id: string; loop_type_id: string; shortening_mm: number | string };

function classify(dev: number, tol: number): "ok" | "warn" | "bad" {
  const a = Math.abs(dev);
  if (a <= tol) return "ok";
  if (a <= tol * 2) return "warn";
  return "bad";
}

const CLASS_STYLE: Record<string, string> = {
  ok: "border-emerald-500/40 bg-emerald-500/5",
  warn: "border-amber-500/50 bg-amber-500/5",
  bad: "border-red-500/50 bg-red-500/5",
  empty: "border-border bg-card",
};
const DOT_STYLE: Record<string, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
  empty: "bg-muted-foreground/30",
};

function SessionDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(sessionQuery(id));
  const { session, lines, measurements } = data;
  const materials = (data as { materials?: Material[] }).materials ?? [];
  const loopTypes = (data as { loopTypes?: LoopType[] }).loopTypes ?? [];
  const shortenings = (data as { shortenings?: Shortening[] }).shortenings ?? [];
  const flaggedByLine = new Map(
    (measurements as MeasurementFull[]).map((m) => [m.line_spec_id, { flagged: Boolean(m.flagged), reason: m.flag_reason ?? "" }]),
  );
  const materialById = new Map(materials.map((m) => [m.id, m]));
  const loopById = new Map(loopTypes.map((l) => [l.id, l]));
  // material_id -> [{ loop, shortening }]
  const loopsByMaterial = new Map<string, { loop: LoopType; shortening: number }[]>();
  for (const s of shortenings) {
    const loop = loopById.get(s.loop_type_id);
    if (!loop) continue;
    const arr = loopsByMaterial.get(s.material_id) ?? [];
    arr.push({ loop, shortening: Number(s.shortening_mm) });
    loopsByMaterial.set(s.material_id, arr);
  }
  const wing = session.wing as {
    id: string;
    serial_number: string;
    owner_note: string | null;
    model: { id: string; brand: string; name: string; size: string | null; cells: number | null };
  };

  // Local edit state, keyed by line_spec_id
  const initial = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of measurements as Measurement[]) {
      map[m.line_spec_id] = String(m.measured_mm ?? "");
    }
    return map;
  }, [measurements]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  useEffect(() => setValues(initial), [initial]);

  const saveMut = useMutation({
    mutationFn: (v: { line_spec_id: string; measured_mm: number }) =>
      upsertMeasurement({ data: { session_id: id, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function onChange(line_spec_id: string, raw: string) {
    setValues((v) => ({ ...v, [line_spec_id]: raw }));
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n <= 0) return;
    if (timers.current[line_spec_id]) clearTimeout(timers.current[line_spec_id]);
    timers.current[line_spec_id] = setTimeout(() => {
      saveMut.mutate({ line_spec_id, measured_mm: n });
    }, 400);
  }

  const readOnly = session.status !== "draft";

  const statusMut = useMutation({
    mutationFn: (status: "draft" | "complete" | "published") =>
      updateSession({ data: { id, status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session", id] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [notes, setNotes] = useState(session.notes ?? "");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [laserOn, setLaserOn] = useState(false);
  const [laserBusy, setLaserBusy] = useState<string | null>(null);

  async function toggleLaser() {
    if (laserOn || isLaserConnected()) {
      disconnectLaser();
      setLaserOn(false);
      toast.info("Laser disconnected");
      return;
    }
    try {
      const name = await connectLaser();
      setLaserOn(true);
      toast.success(`Connected to ${name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect");
    }
  }

  async function readLaserFor(line_spec_id: string, tolerance_mm: number) {
    setLaserBusy(line_spec_id);
    try {
      const mm = await readNextDistanceMm();
      // "laser on, discard implausible" — reject anything absurd for a paraglider line
      if (mm < 100 || mm > 15000) {
        toast.error(`Discarded implausible reading: ${mm} mm`);
        return;
      }
      // Local update + save (bypass the debounce)
      setValues((v) => ({ ...v, [line_spec_id]: String(mm) }));
      saveMut.mutate({ line_spec_id, measured_mm: mm });
      // Suppress the unused var warning
      void tolerance_mm;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No reading");
    } finally {
      setLaserBusy(null);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rowsAny = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const rows: { label: string; measured_mm: number }[] = [];
      for (const r of rowsAny) {
        const keys = Object.keys(r);
        const labelKey = keys.find((k) => /label|line|name/i.test(k)) ?? keys[0];
        const valueKey = keys.find((k) => /mm|measured|length|value/i.test(k)) ?? keys[1];
        const label = String(r[labelKey] ?? "").trim();
        const value = Number(r[valueKey]);
        if (!label || !Number.isFinite(value) || value <= 0) continue;
        rows.push({ label, measured_mm: value });
      }
      if (rows.length === 0) {
        toast.error("No usable rows. Expected two columns: label and measured mm.");
        return;
      }
      const res = await importMeasurementsXlsx({ data: { session_id: id, rows } });
      qc.invalidateQueries({ queryKey: ["session", id] });
      const skipped = res.skipped.length;
      toast.success(
        `Imported ${res.imported} of ${rows.length}${skipped ? ` · ${skipped} skipped (unknown labels)` : ""}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  const notesMut = useMutation({
    mutationFn: () => updateSession({ data: { id, notes } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session", id] });
      toast.success("Notes saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: () => deleteSession({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      navigate({ to: "/sessions" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Merge specs + current values into rows with computed deviation
  const rows = (lines as LineSpec[]).map((l) => {
    const raw = values[l.id];
    const n = Number(raw);
    const hasVal = raw && Number.isFinite(n) && n > 0;
    const factory = Number(l.factory_length_mm);
    const tol = Number(l.tolerance_mm) || 10;
    const dev = hasVal ? n - factory : null;
    const cls = dev === null ? "empty" : classify(dev, tol);
    // Loop recommendation: line too long (dev>0) → apply loop that shortens ≈ dev.
    // We list all loop options for this material, sorted by how close their
    // shortening matches the deviation.
    let suggestion: { loop: LoopType; shortening: number; residual: number } | null = null;
    let alternates: { loop: LoopType; shortening: number; residual: number }[] = [];
    if (dev !== null && l.material_id) {
      const options = loopsByMaterial.get(l.material_id) ?? [];
      if (options.length > 0) {
        const ranked = options
          .map((o) => ({ ...o, residual: dev - o.shortening })) // remaining error after applying loop
          .sort((a, b) => Math.abs(a.residual) - Math.abs(b.residual));
        suggestion = ranked[0];
        alternates = ranked.slice(1, 3);
      }
    }
    const material = l.material_id ? materialById.get(l.material_id) ?? null : null;
    return { line: l, value: raw ?? "", dev, factory, tol, cls, suggestion, alternates, material };
  });

  const grouped = GROUPS.map((g) => ({ group: g, items: rows.filter((r) => r.line.line_group === g) }))
    .filter((g) => g.items.length > 0);

  // Summary per group + overall
  const measured = rows.filter((r) => r.dev !== null);
  const summary = GROUPS.map((g) => {
    const items = measured.filter((r) => r.line.line_group === g);
    if (items.length === 0) return null;
    const avg = items.reduce((s, r) => s + (r.dev ?? 0), 0) / items.length;
    const worst = items.reduce((m, r) => Math.max(m, Math.abs(r.dev ?? 0)), 0);
    return { group: g, count: items.length, avg, worst };
  }).filter(Boolean) as { group: string; count: number; avg: number; worst: number }[];

  const totalLines = rows.length;
  const measuredCount = measured.length;
  const outOfTol = measured.filter((r) => r.cls !== "ok").length;

  const shareToken = (session as { share_token: string | null }).share_token;
  const shareUrl =
    shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/share/${shareToken}`
      : null;

  function copyShare() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(
      () => toast.success("Share link copied"),
      () => toast.error("Could not copy link"),
    );
  }

  const exportRows = rows.map((r) => ({
    id: r.line.id,
    label: r.line.label,
    line_group: r.line.line_group,
    factory: r.factory,
    tol: r.tol,
    measured: r.value ? Number(r.value) : null,
    dev: r.dev,
  }));
  const wingLabel = `${wing.model.brand} ${wing.model.name}${wing.model.size ? ` · ${wing.model.size}` : ""}`;

  return (
    <div>
      <PageHeader
        title={`${wing.model.brand} ${wing.model.name}${wing.model.size ? ` · ${wing.model.size}` : ""}`}
        description={
          `SN ${wing.serial_number} · ${session.session_date} · ${session.status}` +
          ` · ${measuredCount}/${totalLines} lines measured`
        }
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/sessions"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
            </Button>
            {!readOnly && (
              <>
                {isLaserSupported() && (
                  <Button
                    variant={laserOn ? "default" : "outline"}
                    size="sm"
                    onClick={toggleLaser}
                    title="Web Bluetooth · Leica DISTO"
                  >
                    <Radio className="h-4 w-4 mr-2" />
                    {laserOn ? "Laser on" : "Laser"}
                  </Button>
                )}
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={importing}
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" /> {importing ? "Importing…" : "Import XLSX"}
                </Button>
              </>
            )}
            {session.status === "draft" && (
              <Button size="sm" onClick={() => statusMut.mutate("complete")} disabled={statusMut.isPending || measuredCount === 0}>
                <CheckCircle2 className="h-4 w-4 mr-2" />Mark complete
              </Button>
            )}
            {session.status === "complete" && (
              <>
                <Button variant="outline" size="sm" onClick={() => statusMut.mutate("draft")}>
                  Back to draft
                </Button>
                <Button size="sm" onClick={() => statusMut.mutate("published")}>
                  <Share2 className="h-4 w-4 mr-2" />Publish
                </Button>
              </>
            )}
            {session.status === "published" && (
              <>
                {shareUrl && (
                  <>
                    <Button variant="outline" size="sm" onClick={copyShare}>
                      <Copy className="h-4 w-4 mr-2" /> Copy link
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={shareUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" /> Open protocol
                      </a>
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={() => statusMut.mutate("complete")}>
                  Unpublish
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={measuredCount === 0}
              onClick={() =>
                exportProtocolPdf({
                  wing_label: wingLabel,
                  serial: wing.serial_number,
                  session_date: session.session_date,
                  rows: exportRows,
                  notes: session.notes,
                }).catch((e) => toast.error(e instanceof Error ? e.message : "PDF failed"))
              }
            >
              <Printer className="h-4 w-4 mr-2" /> PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={measuredCount === 0}
              onClick={() =>
                exportProtocolXlsx({
                  wing_label: wingLabel,
                  serial: wing.serial_number,
                  session_date: session.session_date,
                  rows: exportRows,
                  notes: session.notes,
                }).catch((e) => toast.error(e instanceof Error ? e.message : "XLSX failed"))
              }
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" /> XLSX
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this session?")) delMut.mutate(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        <EstimatesDisclaimer />
        {/* Summary */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <SummaryCard label="Measured" value={`${measuredCount} / ${totalLines}`} />
          <SummaryCard label="Out of tolerance" value={String(outOfTol)} tone={outOfTol === 0 ? "ok" : outOfTol > 2 ? "bad" : "warn"} />
          <SummaryCard label="Worst deviation" value={measured.length ? `${Math.max(...measured.map((r) => Math.abs(r.dev ?? 0))).toFixed(1)} mm` : "—"} />
          <SummaryCard label="Avg deviation" value={measured.length ? `${(measured.reduce((s, r) => s + (r.dev ?? 0), 0) / measured.length).toFixed(1)} mm` : "—"} />
        </div>

        {summary.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Deviation per group</h3>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
              {summary.map((g) => (
                <div key={g.group} className="text-sm">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Group {g.group}</div>
                  <div className="mt-1 font-mono">
                    avg <span className="font-semibold">{g.avg >= 0 ? "+" : ""}{g.avg.toFixed(1)}</span> mm
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">worst {g.worst.toFixed(1)} mm · {g.count} lines</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <AoIDiagram rows={exportRows} />

        {/* Measurement grid */}
        {grouped.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">This model has no linemap yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add lines to <Link to="/models/$id" params={{ id: wing.model.id }} className="underline">the model</Link> first.
            </p>
          </div>
        ) : (
          grouped.map((g) => (
            <section key={g.group}>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Group {g.group}
              </h2>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {g.items.map((r) => (
                  <div
                    key={r.line.id}
                    className={`rounded-md border p-3 transition-colors ${CLASS_STYLE[r.cls]}`}
                    style={{ boxShadow: "var(--shadow-panel)" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-primary">{r.line.label}</span>
                      <div className="flex items-center gap-1">
                        {flaggedByLine.get(r.line.id)?.flagged && (
                          <span
                            title={flaggedByLine.get(r.line.id)?.reason ?? "Implausible reading"}
                            className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400"
                          >
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                        )}
                        <span className={`h-2 w-2 rounded-full ${DOT_STYLE[r.cls]}`} />
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                      factory {r.factory.toFixed(0)} ± {r.tol.toFixed(1)}
                    </div>
                    <Input
                      inputMode="decimal"
                      type="number"
                      step="0.1"
                      readOnly={readOnly}
                      value={r.value}
                      onChange={(e) => onChange(r.line.id, e.target.value)}
                      placeholder="mm"
                      className="mt-2 font-mono text-lg tabular-nums h-9"
                    />
                    <div className="mt-1 font-mono text-xs tabular-nums h-4">
                      {r.dev === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={
                            r.cls === "ok"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : r.cls === "warn"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {r.dev >= 0 ? "+" : ""}{r.dev.toFixed(1)} mm
                          <span className="text-muted-foreground ml-1">
                            ({((r.dev / r.factory) * 100).toFixed(2)}%)
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="mt-2 border-t border-border/60 pt-2 min-h-[46px]">
                      {r.dev === null || r.cls === "ok" ? (
                        <div className="text-[10px] text-muted-foreground">
                          {r.material ? r.material.name : "no material"}
                          {r.cls === "ok" && r.dev !== null ? " · within tolerance" : ""}
                        </div>
                      ) : !r.line.material_id ? (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400">
                          Set line material to get loop suggestion
                        </div>
                      ) : !r.suggestion ? (
                        <div className="text-[10px] text-muted-foreground">
                          No loops mapped for {r.material?.name ?? "material"}
                        </div>
                      ) : (
                        <>
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Suggested loop</div>
                          <div className="font-mono text-sm font-semibold">
                            {r.suggestion.loop.name}
                            <span className="text-muted-foreground font-normal ml-1">
                              (−{r.suggestion.shortening.toFixed(1)} mm)
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            residual {r.suggestion.residual >= 0 ? "+" : ""}{r.suggestion.residual.toFixed(1)} mm
                            {r.alternates.length > 0 && (
                              <> · alt: {r.alternates.map((a) => a.loop.name).join(", ")}</>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

        {/* Notes */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-2">Notes</h3>
          <Textarea
            rows={3}
            value={notes}
            readOnly={readOnly}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observations, hangar conditions, ballast, technician remarks…"
          />
          {!readOnly && (
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => notesMut.mutate()} disabled={notesMut.isPending}>
                Save notes
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  const toneCls =
    tone === "ok" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "warn" ? "text-amber-600 dark:text-amber-400"
    : tone === "bad" ? "text-red-600 dark:text-red-400"
    : "";
  return (
    <div className="rounded-lg border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-panel)" }}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}