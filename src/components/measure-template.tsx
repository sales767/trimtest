import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Crosshair, AlertTriangle } from "lucide-react";

export type TemplateRow = {
  id: string;
  label: string;
  line_group: string;
  side: "left" | "right" | "center" | null;
  point_index: number | null;
  factory: number;
  tol: number;
  value: string;
  dev: number | null;
  cls: "ok" | "warn" | "bad" | "empty";
  flagged?: boolean;
  flagReason?: string;
  suggestion?: { name: string; shortening: number; residual: number } | null;
};

const CELL_TONE: Record<string, string> = {
  ok: "border-emerald-500/40 bg-emerald-500/5",
  warn: "border-amber-500/50 bg-amber-500/10",
  bad: "border-red-500/50 bg-red-500/10",
  empty: "border-border bg-background",
};
const TEXT_TONE: Record<string, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
  empty: "text-muted-foreground",
};

/**
 * The measuring template: one printed-sheet-like grid per line group with the
 * left riser on the left, the right riser on the right and the factory value in
 * the middle. Technicians type straight into the cells and tab/enter down the
 * wing exactly like they would on paper.
 */
export function MeasureTemplate({
  rows,
  readOnly,
  laserOn,
  laserBusy,
  onChange,
  onReadLaser,
  activeId,
  onActive,
  compact = false,
}: {
  rows: TemplateRow[];
  readOnly: boolean;
  laserOn?: boolean;
  laserBusy?: string | null;
  onChange: (lineId: string, raw: string) => void;
  onReadLaser?: (lineId: string) => void;
  activeId?: string | null;
  onActive?: (lineId: string) => void;
  compact?: boolean;
}) {
  const inputs = useRef<HTMLInputElement[]>([]);
  inputs.current = [];

  function register(el: HTMLInputElement | null) {
    if (el) inputs.current.push(el);
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const list = inputs.current;
    const i = list.indexOf(e.currentTarget);
    if (i < 0) return;
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      list[Math.min(i + 1, list.length - 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[Math.max(i - 1, 0)]?.focus();
    }
  }

  const groups = Array.from(new Set(rows.map((r) => r.line_group)));

  return (
    <div className={compact ? "space-y-2" : "space-y-6"}>
      {groups.map((g) => {
        const items = rows.filter((r) => r.line_group === g);
        // Group by attachment point so left/right sit on the same visual row.
        const keys = Array.from(
          new Set(items.map((r) => String(r.point_index ?? r.label.replace(/[LR]$/, "")))),
        );
        const done = items.filter((r) => r.dev !== null).length;
        return (
          <section key={g} className="rounded-lg border border-border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-panel)" }}>
            <header className={`flex items-center justify-between gap-3 border-b border-border bg-muted/40 ${compact ? "px-2 py-1" : "px-4 py-2"}`}>
              <h2 className={`font-semibold uppercase tracking-widest ${compact ? "text-[11px]" : "text-sm"}`}>
                {g === "BR" ? "Brakes" : g === "STAB" ? "Stabilo" : `Row ${g}`}
              </h2>
              <span className={`text-muted-foreground tabular-nums ${compact ? "text-[10px]" : "text-xs"}`}>
                {done}/{items.length} measured
              </span>
            </header>
            <div className="divide-y divide-border">
              {!compact && (
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <div>Left</div>
                  <div className="w-28 text-center">Point · factory</div>
                  <div className="text-right">Right</div>
                </div>
              )}
              {keys.map((k) => {
                const left = items.find(
                  (r) => String(r.point_index ?? r.label.replace(/[LR]$/, "")) === k && r.side === "left",
                );
                const right = items.find(
                  (r) => String(r.point_index ?? r.label.replace(/[LR]$/, "")) === k && r.side === "right",
                );
                const single = !left && !right
                  ? items.find((r) => String(r.point_index ?? r.label.replace(/[LR]$/, "")) === k)
                  : undefined;
                const factory = (left ?? right ?? single)?.factory ?? 0;
                const tol = (left ?? right ?? single)?.tol ?? 10;
                const pointLabel =
                  (left ?? right)?.point_index != null ? `${g}${(left ?? right)!.point_index}` : (single?.label ?? `${g}${k}`);
                return (
                  <div key={`${g}-${k}`} className={`grid grid-cols-[1fr_auto_1fr] items-center ${compact ? "gap-1 px-2 py-0.5" : "gap-2 px-4 py-2"}`}>
                    <Cell row={left ?? single} align="left" compact={compact} readOnly={readOnly} laserOn={laserOn} laserBusy={laserBusy} onChange={onChange} onReadLaser={onReadLaser} register={register} onKeyDown={onKeyDown} activeId={activeId} onActive={onActive} />
                    <div className={compact ? "w-16 text-center" : "w-28 text-center"}>
                      <div className={`font-mono font-semibold ${compact ? "text-[11px] leading-tight" : "text-sm"}`}>{pointLabel}</div>
                      <div className="font-mono text-[10px] text-muted-foreground tabular-nums leading-tight">
                        {factory.toFixed(0)}{compact ? "" : ` ± ${tol.toFixed(0)}`}
                      </div>
                    </div>
                    <Cell row={right} align="right" compact={compact} readOnly={readOnly} laserOn={laserOn} laserBusy={laserBusy} onChange={onChange} onReadLaser={onReadLaser} register={register} onKeyDown={onKeyDown} activeId={activeId} onActive={onActive} />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Cell({
  row,
  align,
  compact = false,
  readOnly,
  laserOn,
  laserBusy,
  onChange,
  onReadLaser,
  register,
  onKeyDown,
  activeId,
  onActive,
}: {
  row?: TemplateRow;
  align: "left" | "right";
  compact?: boolean;
  readOnly: boolean;
  laserOn?: boolean;
  laserBusy?: string | null;
  onChange: (lineId: string, raw: string) => void;
  onReadLaser?: (lineId: string) => void;
  register: (el: HTMLInputElement | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  activeId?: string | null;
  onActive?: (lineId: string) => void;
}) {
  if (!row) return <div />;
  const isActive = activeId === row.id;
  return (
    <div
      id={`line-${row.id}`}
      onMouseEnter={() => onActive?.(row.id)}
      className={`rounded-md border transition-shadow ${compact ? "px-1 py-0.5" : "px-2 py-1.5"} ${CELL_TONE[row.cls]} ${isActive ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
    >
      <div className={`flex items-center ${compact ? "gap-1" : "gap-2"} ${align === "right" ? "flex-row-reverse" : ""}`}>
        <Input
          ref={register}
          onKeyDown={onKeyDown}
          onFocus={() => onActive?.(row.id)}
          inputMode="decimal"
          type="number"
          step="0.1"
          readOnly={readOnly}
          value={row.value}
          onChange={(e) => onChange(row.id, e.target.value)}
          placeholder="mm"
          className={compact ? "h-7 w-20 px-1.5 font-mono text-xs tabular-nums" : "h-9 w-28 font-mono text-base tabular-nums"}
        />
        <div className={`min-w-0 flex-1 ${align === "right" ? "text-left" : "text-right"}`}>
          <div className={`font-mono tabular-nums ${compact ? "text-[10px] leading-tight" : "text-xs"} ${TEXT_TONE[row.cls]}`}>
            {row.dev === null ? "—" : `${row.dev >= 0 ? "+" : ""}${row.dev.toFixed(1)} mm`}
            {row.flagged && (
              <AlertTriangle className="ml-1 inline h-3 w-3 text-amber-600 dark:text-amber-400" aria-label={row.flagReason} />
            )}
          </div>
          {!compact && row.suggestion && row.cls !== "ok" && row.dev !== null && (
            <div className="truncate font-mono text-[10px] text-muted-foreground">
              loop: {row.suggestion.name} (−{row.suggestion.shortening.toFixed(0)})
            </div>
          )}
        </div>
        {!readOnly && laserOn && onReadLaser && (
          <Button
            variant="outline"
            size="icon"
            className={compact ? "h-6 w-6 shrink-0" : "h-8 w-8 shrink-0"}
            disabled={laserBusy === row.id}
            onClick={() => onReadLaser(row.id)}
            title="Read laser"
          >
            <Crosshair className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {!compact && <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.label}</div>}
    </div>
  );
}