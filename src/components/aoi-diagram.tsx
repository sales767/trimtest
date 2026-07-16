import { useMemo, useState } from "react";

type Row = {
  id: string;
  label: string;
  line_group: string;
  factory: number;
  tol: number;
  measured: number | null;
  dev: number | null;
};

type Mode = "raw" | "symmetry";

function classify(dev: number, tol: number) {
  const a = Math.abs(dev);
  if (a <= tol) return "hsl(142 71% 45%)"; // emerald
  if (a <= 2 * tol) return "hsl(38 92% 50%)"; // amber
  return "hsl(0 84% 60%)";
}

export function AoIDiagram({ rows }: { rows: Row[] }) {
  const [mode, setMode] = useState<Mode>("raw");
  const groups = useMemo(() => {
    const gs = Array.from(new Set(rows.map((r) => r.line_group)));
    return gs.map((g) => {
      const items = rows.filter((r) => r.line_group === g && r.dev !== null);
      const median = items.length
        ? [...items].map((r) => r.dev ?? 0).sort((a, b) => a - b)[Math.floor(items.length / 2)]
        : 0;
      return { g, items, median };
    }).filter((x) => x.items.length > 0);
  }, [rows]);

  const maxAbs = Math.max(
    10,
    ...groups.flatMap((gr) => gr.items.map((r) => Math.abs(mode === "symmetry" ? (r.dev ?? 0) - gr.median : r.dev ?? 0))),
  );

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Measure at least one line to see the angle-of-incidence estimate.
      </div>
    );
  }

  const width = 640;
  const rowH = 22;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Angle of incidence · estimate</h3>
          <p className="text-[11px] text-muted-foreground">
            Horizontal offset ≈ deviation from factory length. Colour bands reflect tolerance.
          </p>
        </div>
        <div className="flex text-xs rounded-md border border-border overflow-hidden">
          {(["raw", "symmetry"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 ${mode === m ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"}`}
            >
              {m === "raw" ? "Raw dev" : "Symmetry (Δ vs group median)"}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {groups.map((gr) => (
          <div key={gr.g}>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
              Group {gr.g}
              {mode === "symmetry" && (
                <span className="ml-2 text-[10px] font-mono text-muted-foreground">
                  median dev {gr.median >= 0 ? "+" : ""}{gr.median.toFixed(1)} mm
                </span>
              )}
            </div>
            <svg viewBox={`0 0 ${width} ${gr.items.length * rowH + 16}`} className="w-full h-auto">
              {/* zero line */}
              <line x1={width / 2} y1={0} x2={width / 2} y2={gr.items.length * rowH + 8} stroke="hsl(var(--border))" strokeDasharray="2 3" />
              {/* tolerance band using worst tol as reference */}
              {(() => {
                const tol = gr.items[0]?.tol ?? 10;
                const px = (tol / maxAbs) * (width / 2 - 40);
                return (
                  <rect
                    x={width / 2 - px}
                    y={0}
                    width={px * 2}
                    height={gr.items.length * rowH + 8}
                    fill="hsl(142 71% 45% / 0.08)"
                  />
                );
              })()}
              {gr.items.map((r, i) => {
                const v = mode === "symmetry" ? (r.dev ?? 0) - gr.median : r.dev ?? 0;
                const px = (v / maxAbs) * (width / 2 - 40);
                const cx = width / 2 + px;
                const y = i * rowH + rowH / 2 + 4;
                return (
                  <g key={r.id}>
                    <text x={8} y={y + 4} fontSize={10} fill="hsl(var(--muted-foreground))" fontFamily="ui-monospace,monospace">
                      {r.label}
                    </text>
                    <line x1={width / 2} y1={y} x2={cx} y2={y} stroke={classify(v, r.tol)} strokeWidth={2} />
                    <circle cx={cx} cy={y} r={4} fill={classify(v, r.tol)} />
                    <text x={cx + (px >= 0 ? 8 : -8)} y={y + 3} fontSize={9} textAnchor={px >= 0 ? "start" : "end"} fill="hsl(var(--foreground))" fontFamily="ui-monospace,monospace">
                      {v >= 0 ? "+" : ""}{v.toFixed(1)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EstimatesDisclaimer() {
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
      Estimates from partial data. This tool complements — it does not replace — a professional trim check.
    </div>
  );
}