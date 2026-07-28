import { useMemo } from "react";

export type DiagramRow = {
  id: string;
  label: string;
  line_group: string;
  side: "left" | "right" | "center" | null;
  point_index: number | null;
  cls: "ok" | "warn" | "bad" | "empty";
};

const DOT_FILL: Record<DiagramRow["cls"], string> = {
  ok: "hsl(142 71% 45%)",
  warn: "hsl(38 92% 50%)",
  bad: "hsl(0 84% 60%)",
  empty: "hsl(var(--muted-foreground) / 0.35)",
};

const GROUP_ORDER = ["A", "B", "C", "D", "E", "BR", "STAB"];

function groupLabel(g: string) {
  return g === "BR" ? "Brakes" : g === "STAB" ? "Stab" : g;
}

/**
 * Top-view canopy schematic. Every riser attachment point is a dot placed by
 * span position (point index) and chord position (line group). The point that
 * is currently being measured blinks so the technician can see at a glance
 * where on the wing the tape/laser should be.
 */
export function WingDiagram({
  rows,
  activeId,
  onSelect,
}: {
  rows: DiagramRow[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const W = 820;
  const H = 360;
  const cx = W / 2;
  const halfSpan = 348;
  const sag = 78; // anhedral curvature of the arc

  const groups = useMemo(() => {
    const present = Array.from(new Set(rows.map((r) => r.line_group)));
    return present.sort(
      (a, b) =>
        (GROUP_ORDER.indexOf(a) < 0 ? 99 : GROUP_ORDER.indexOf(a)) -
        (GROUP_ORDER.indexOf(b) < 0 ? 99 : GROUP_ORDER.indexOf(b)),
    );
  }, [rows]);

  const maxPoint = useMemo(
    () => Math.max(1, ...rows.map((r) => r.point_index ?? 1)),
    [rows],
  );

  if (rows.length === 0) return null;

  const chordTop = 96;
  const chordBottom = 236;
  const step = groups.length > 1 ? (chordBottom - chordTop) / (groups.length - 1) : 0;

  // arc: vertical drop as a function of horizontal distance from centre
  const drop = (x: number) => sag * Math.pow(Math.abs(x - cx) / halfSpan, 2);

  function pos(r: DiagramRow) {
    const gi = Math.max(0, groups.indexOf(r.line_group));
    const p = r.point_index ?? 1;
    const t = maxPoint === 1 ? 0 : (p - 1) / (maxPoint - 1);
    const spanFrac = 0.1 + t * 0.84;
    const dir = r.side === "right" ? 1 : r.side === "left" ? -1 : 0;
    const x = cx + dir * spanFrac * halfSpan;
    const y = chordTop + gi * step + drop(x);
    return { x, y };
  }

  // canopy outline (leading edge + trailing edge following the same arc)
  const edge = (yBase: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = cx - halfSpan + (i / 40) * halfSpan * 2;
      const taper = Math.pow(Math.abs(x - cx) / halfSpan, 3) * 26;
      pts.push(`${x.toFixed(1)},${(yBase + drop(x) + (yBase < 100 ? taper : -taper)).toFixed(1)}`);
    }
    return pts.join(" ");
  };

  const active = rows.find((r) => r.id === activeId) ?? null;

  return (
    <div className="rounded-lg border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-panel)" }}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-widest">Wing map</h3>
        <p className="font-mono text-xs text-muted-foreground">
          {active ? `measuring ${active.label}` : "select a cell to highlight the point"}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Paraglider top view with measuring points">
        <defs>
          <linearGradient id="wd-canopy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.20)" />
            <stop offset="100%" stopColor="hsl(var(--primary) / 0.05)" />
          </linearGradient>
        </defs>

        {/* canopy body */}
        <polygon
          points={`${edge(60)} ${edge(268).split(" ").reverse().join(" ")}`}
          fill="url(#wd-canopy)"
          stroke="hsl(var(--border))"
          strokeWidth={1.5}
        />
        {/* cell ribs */}
        {Array.from({ length: 25 }, (_, i) => {
          const x = cx - halfSpan + ((i + 0.5) / 25) * halfSpan * 2;
          const t1 = Math.pow(Math.abs(x - cx) / halfSpan, 3) * 26;
          return (
            <line
              key={i}
              x1={x}
              y1={60 + drop(x) + t1}
              x2={x}
              y2={268 + drop(x) - t1}
              stroke="hsl(var(--border))"
              strokeWidth={0.6}
              opacity={0.55}
            />
          );
        })}

        {/* chord (group) guide lines + labels */}
        {groups.map((g, gi) => {
          const y = chordTop + gi * step;
          return (
            <g key={g}>
              <text x={12} y={y + drop(12) + 4} fontSize={11} fontFamily="ui-monospace,monospace" fill="hsl(var(--muted-foreground))">
                {groupLabel(g)}
              </text>
              <text x={W - 12} y={y + drop(W - 12) + 4} fontSize={11} textAnchor="end" fontFamily="ui-monospace,monospace" fill="hsl(var(--muted-foreground))">
                {groupLabel(g)}
              </text>
            </g>
          );
        })}

        {/* centre line */}
        <line x1={cx} y1={48} x2={cx} y2={300} stroke="hsl(var(--border))" strokeDasharray="3 4" />

        {/* attachment points */}
        {rows.map((r) => {
          const { x, y } = pos(r);
          const isActive = r.id === activeId;
          return (
            <g
              key={r.id}
              onClick={() => onSelect?.(r.id)}
              style={{ cursor: onSelect ? "pointer" : "default" }}
            >
              <title>{r.label}</title>
              {isActive && (
                <>
                  <circle cx={x} cy={y} r={16} fill="hsl(var(--primary) / 0.35)">
                    <animate attributeName="r" values="9;20;9" dur="1.1s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.75;0;0.75" dur="1.1s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={x} cy={y} r={9} fill="none" stroke="hsl(var(--primary))" strokeWidth={2}>
                    <animate attributeName="opacity" values="1;0.25;1" dur="0.7s" repeatCount="indefinite" />
                  </circle>
                </>
              )}
              <circle
                cx={x}
                cy={y}
                r={isActive ? 5.5 : 4}
                fill={DOT_FILL[r.cls]}
                stroke="hsl(var(--card))"
                strokeWidth={1}
              />
            </g>
          );
        })}

        {/* active label callout */}
        {active && (() => {
          const { x, y } = pos(active);
          return (
            <text
              x={x}
              y={y - 22}
              fontSize={12}
              textAnchor="middle"
              fontFamily="ui-monospace,monospace"
              fill="hsl(var(--primary))"
              fontWeight={700}
            >
              {active.label}
            </text>
          );
        })()}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: DOT_FILL.ok }} /> in tolerance</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: DOT_FILL.warn }} /> warning</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: DOT_FILL.bad }} /> out of tolerance</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: DOT_FILL.empty }} /> not measured</span>
      </div>
    </div>
  );
}