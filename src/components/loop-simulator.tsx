import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Check } from "lucide-react";

type Row = {
  line_spec_id: string;
  label: string;
  line_group: string;
  factory: number;
  tol: number;
  measured: number | null;
  dev: number | null; // raw
  material_id: string | null;
};
type LoopType = { id: string; name: string };
type Shortening = { material_id: string; loop_type_id: string; shortening_mm: number | string };

type Mark = "installed" | "candidate" | null;

// Interactive loop-installation simulator. For each row that has a material
// and a deviation, users can mark a loop option as "candidate" (preview the
// residual) or "installed" (persist mentally as the applied option). The
// SVG bar shows current dev, the loop shortening, and the projected residual.
export function LoopSimulator({
  rows,
  loopTypes,
  shortenings,
}: {
  rows: Row[];
  loopTypes: LoopType[];
  shortenings: Shortening[];
}) {
  // per-line pick: loop_type_id + state
  const [picks, setPicks] = useState<Record<string, { loop_id: string; state: Mark }>>({});

  const loopById = new Map(loopTypes.map((l) => [l.id, l]));
  const loopsByMaterial = useMemo(() => {
    const map = new Map<string, { loop: LoopType; shortening: number }[]>();
    for (const s of shortenings) {
      const loop = loopById.get(s.loop_type_id);
      if (!loop) continue;
      const arr = map.get(s.material_id) ?? [];
      arr.push({ loop, shortening: Number(s.shortening_mm) });
      map.set(s.material_id, arr);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortenings, loopTypes]);

  const items = rows.filter((r) => r.dev !== null && r.material_id);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Measure lines with a material assigned to simulate loop installations.
      </div>
    );
  }

  const width = 320;
  const maxAbs = Math.max(10, ...items.map((r) => Math.abs(r.dev ?? 0)));

  function pickFor(r: Row): { loop: LoopType; shortening: number } | null {
    const pick = picks[r.line_spec_id];
    if (!pick) return null;
    const opts = loopsByMaterial.get(r.material_id ?? "") ?? [];
    return opts.find((o) => o.loop.id === pick.loop_id) ?? null;
  }

  function residualFor(r: Row): number | null {
    const p = pickFor(r);
    if (!p || r.dev === null) return null;
    return r.dev - p.shortening;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Loop simulator · estimate</h3>
          <p className="text-[11px] text-muted-foreground">
            Click a loop to mark as candidate. Long-press or the ✓ button marks as installed. Reset clears choices.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPicks({})}
          disabled={Object.keys(picks).length === 0}
        >
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>
      </div>

      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
        {items.map((r) => {
          const options = loopsByMaterial.get(r.material_id ?? "") ?? [];
          const pick = picks[r.line_spec_id];
          const chosen = pickFor(r);
          const residual = residualFor(r);
          return (
            <div key={r.line_spec_id} className="rounded-md border border-border p-2">
              <div className="flex items-center justify-between text-xs">
                <div className="font-mono">
                  <span className="text-muted-foreground mr-2">{r.line_group}</span>
                  <span className="font-semibold">{r.label}</span>
                </div>
                <div className="font-mono text-muted-foreground">
                  dev <span className="text-foreground">{r.dev! >= 0 ? "+" : ""}{r.dev!.toFixed(1)}</span> mm
                  {chosen && (
                    <> · after loop <span className={
                      residual !== null && Math.abs(residual) <= r.tol ? "text-emerald-600" :
                      residual !== null && Math.abs(residual) <= 2 * r.tol ? "text-amber-600" : "text-red-600"
                    }>{residual! >= 0 ? "+" : ""}{residual!.toFixed(1)}</span> mm</>
                  )}
                </div>
              </div>
              <svg viewBox={`0 0 ${width} 20`} className="w-full h-5 mt-1">
                <line x1={width / 2} y1={0} x2={width / 2} y2={20} stroke="hsl(var(--border))" strokeDasharray="2 3" />
                {/* current dev */}
                <line
                  x1={width / 2}
                  x2={width / 2 + ((r.dev ?? 0) / maxAbs) * (width / 2 - 20)}
                  y1={7}
                  y2={7}
                  stroke="hsl(0 84% 60%)"
                  strokeWidth={3}
                />
                {/* residual after chosen loop */}
                {residual !== null && (
                  <line
                    x1={width / 2}
                    x2={width / 2 + (residual / maxAbs) * (width / 2 - 20)}
                    y1={14}
                    y2={14}
                    stroke={Math.abs(residual) <= r.tol ? "hsl(142 71% 45%)" : "hsl(38 92% 50%)"}
                    strokeWidth={3}
                  />
                )}
              </svg>
              <div className="mt-1 flex flex-wrap gap-1">
                {options.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground">No loops mapped for this material.</span>
                ) : (
                  options.map((o) => {
                    const selected = pick?.loop_id === o.loop.id;
                    const state = selected ? pick!.state : null;
                    return (
                      <button
                        key={o.loop.id}
                        onClick={() =>
                          setPicks({
                            ...picks,
                            [r.line_spec_id]: { loop_id: o.loop.id, state: "candidate" },
                          })
                        }
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          state === "installed"
                            ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-400"
                            : state === "candidate"
                            ? "bg-primary/15 border-primary text-primary"
                            : "border-border text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {o.loop.name} <span className="opacity-70">−{o.shortening.toFixed(1)}</span>
                      </button>
                    );
                  })
                )}
                {pick && (
                  <button
                    onClick={() =>
                      setPicks({
                        ...picks,
                        [r.line_spec_id]: {
                          loop_id: pick.loop_id,
                          state: pick.state === "installed" ? "candidate" : "installed",
                        },
                      })
                    }
                    className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                    title="Toggle installed"
                  >
                    <Check className="h-3 w-3 inline -mt-0.5 mr-0.5" />
                    {pick.state === "installed" ? "installed" : "mark installed"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}