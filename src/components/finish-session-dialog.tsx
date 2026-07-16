import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { finishSession, getSessionExtras } from "@/lib/session-extras.functions";

type LineSpec = {
  id: string;
  label: string;
  line_group: string;
  material_id: string | null;
};
type LoopType = { id: string; name: string };
type WingLoop = { line_spec_id: string; loop_type_id: string | null };

const GROUPS = ["A", "B", "C", "D", "BR", "STAB"] as const;

export function FinishSessionDialog({
  open,
  onOpenChange,
  sessionId,
  lines,
  loopTypes,
  wingLoopState,
  defaultComment,
  publishOnFinish,
  onFinished,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessionId: string;
  lines: LineSpec[];
  loopTypes: LoopType[];
  wingLoopState: WingLoop[];
  defaultComment: string | null;
  publishOnFinish: boolean;
  onFinished: () => void;
}) {
  const qc = useQueryClient();
  const [changedLoops, setChangedLoops] = useState(false);
  const [hasCascade, setHasCascade] = useState(false);
  const [hasInserts, setHasInserts] = useState(false);
  const [comment, setComment] = useState(defaultComment ?? "");
  const [anonymous, setAnonymous] = useState(false);
  const [syncWing, setSyncWing] = useState(true);

  const currentLoopByLine = new Map(wingLoopState.map((w) => [w.line_spec_id, w.loop_type_id]));
  const [changes, setChanges] = useState<Record<string, string>>({}); // line_spec_id -> new loop id ("" = none)
  const [cascades, setCascades] = useState<{ line_group: string; description: string }[]>([]);
  const [inserts, setInserts] = useState<{ line_spec_id: string | null; description: string; length_change_mm: number }[]>([]);

  // Pre-load existing extras if the dialog re-opens
  useQuery({
    queryKey: ["session-extras", sessionId],
    queryFn: () => getSessionExtras({ data: { session_id: sessionId } }),
    enabled: open,
    // Seed local state on first fetch
    select: (data) => {
      if (data.cascades.length && cascades.length === 0) {
        setHasCascade(true);
        setCascades(data.cascades.map((c) => ({ line_group: c.line_group, description: c.description })));
      }
      if (data.inserts.length && inserts.length === 0) {
        setHasInserts(true);
        setInserts(data.inserts.map((i) => ({
          line_spec_id: i.line_spec_id ?? null,
          description: i.description,
          length_change_mm: Number(i.length_change_mm),
        })));
      }
      if (data.loopChanges.length && Object.keys(changes).length === 0) {
        setChangedLoops(true);
        const patch: Record<string, string> = {};
        for (const c of data.loopChanges) patch[c.line_spec_id] = c.new_loop_type_id ?? "";
        setChanges(patch);
      }
      return data;
    },
  });

  const mut = useMutation({
    mutationFn: () =>
      finishSession({
        data: {
          session_id: sessionId,
          comment: comment || null,
          publish_anonymously: anonymous,
          sync_wing_loop_state: syncWing && changedLoops,
          publish: publishOnFinish,
          changes: changedLoops
            ? Object.entries(changes).map(([line_spec_id, v]) => ({
                line_spec_id,
                previous_loop_type_id: currentLoopByLine.get(line_spec_id) ?? null,
                new_loop_type_id: v || null,
                applied: true,
              }))
            : [],
          cascades: hasCascade ? cascades.filter((c) => c.description.trim().length > 0) : [],
          inserts: hasInserts
            ? inserts.filter((r) => r.description.trim().length > 0 && Number.isFinite(r.length_change_mm))
            : [],
        },
      }),
    onSuccess: () => {
      toast.success(publishOnFinish ? "Session published" : "Session marked complete");
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      qc.invalidateQueries({ queryKey: ["session-extras", sessionId] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      onFinished();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finish session</DialogTitle>
          <DialogDescription>
            Record loop, cascade and insert changes applied during this trim check.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Yes/no 1 — loops */}
          <section className="space-y-3">
            <YesNo label="Did you change any loops on this wing?" value={changedLoops} onChange={setChangedLoops} />
            {changedLoops && (
              <div className="rounded-md border border-border p-3 space-y-2 max-h-64 overflow-y-auto">
                <div className="text-xs text-muted-foreground">Pick a new loop per line (leave blank to keep current).</div>
                {lines.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 text-xs">
                    <span className="w-8 text-muted-foreground">{l.line_group}</span>
                    <span className="w-14 font-mono">{l.label}</span>
                    <select
                      className="flex-1 rounded border border-input bg-background text-xs h-7 px-2"
                      value={changes[l.id] ?? (currentLoopByLine.get(l.id) ?? "")}
                      onChange={(e) => setChanges({ ...changes, [l.id]: e.target.value })}
                    >
                      <option value="">— none —</option>
                      {loopTypes.map((lt) => (
                        <option key={lt.id} value={lt.id}>{lt.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <label className="flex items-center gap-2 pt-2 text-xs">
                  <Checkbox checked={syncWing} onCheckedChange={(v) => setSyncWing(v === true)} />
                  Also update the wing's current installed-loop state
                </label>
              </div>
            )}
          </section>

          {/* Yes/no 2 — cascades */}
          <section className="space-y-3">
            <YesNo label="Did you make any cascade changes?" value={hasCascade} onChange={setHasCascade} />
            {hasCascade && (
              <div className="rounded-md border border-border p-3 space-y-2">
                {cascades.map((c, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <select
                      className="rounded border border-input bg-background text-xs h-8 px-2"
                      value={c.line_group}
                      onChange={(e) => {
                        const next = [...cascades];
                        next[i] = { ...c, line_group: e.target.value };
                        setCascades(next);
                      }}
                    >
                      {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <Textarea
                      rows={1}
                      className="flex-1"
                      placeholder="Describe the cascade change (which cascade, what you did)…"
                      value={c.description}
                      onChange={(e) => {
                        const next = [...cascades];
                        next[i] = { ...c, description: e.target.value };
                        setCascades(next);
                      }}
                    />
                    <Button variant="ghost" size="icon" onClick={() => setCascades(cascades.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setCascades([...cascades, { line_group: "A", description: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add cascade
                </Button>
              </div>
            )}
          </section>

          {/* Yes/no 3 — line inserts */}
          <section className="space-y-3">
            <YesNo label="Did you add or remove any line inserts?" value={hasInserts} onChange={setHasInserts} />
            {hasInserts && (
              <div className="rounded-md border border-border p-3 space-y-2">
                {inserts.map((r, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <select
                      className="rounded border border-input bg-background text-xs h-8 px-2"
                      value={r.line_spec_id ?? ""}
                      onChange={(e) => {
                        const next = [...inserts];
                        next[i] = { ...r, line_spec_id: e.target.value || null };
                        setInserts(next);
                      }}
                    >
                      <option value="">— any line —</option>
                      {lines.map((l) => (
                        <option key={l.id} value={l.id}>{l.line_group} · {l.label}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      step="0.1"
                      className="w-24 font-mono"
                      placeholder="±mm"
                      value={Number.isFinite(r.length_change_mm) ? r.length_change_mm : ""}
                      onChange={(e) => {
                        const next = [...inserts];
                        next[i] = { ...r, length_change_mm: Number(e.target.value) };
                        setInserts(next);
                      }}
                    />
                    <Textarea
                      rows={1}
                      className="flex-1"
                      placeholder="Describe the insert change…"
                      value={r.description}
                      onChange={(e) => {
                        const next = [...inserts];
                        next[i] = { ...r, description: e.target.value };
                        setInserts(next);
                      }}
                    />
                    <Button variant="ghost" size="icon" onClick={() => setInserts(inserts.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setInserts([...inserts, { line_spec_id: null, description: "", length_change_mm: 0 }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add insert change
                </Button>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <Label>Session comment</Label>
            <Textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anything to note for future measurements or for the pilot."
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={anonymous} onCheckedChange={(v) => setAnonymous(v === true)} />
              Publish anonymously (hide technician + serial in public feed)
            </label>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Saving…" : publishOnFinish ? "Finish and publish" : "Finish session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex rounded-md border border-border overflow-hidden text-xs">
        <button className={`px-3 py-1 ${!value ? "bg-primary text-primary-foreground" : "bg-background"}`} onClick={() => onChange(false)}>No</button>
        <button className={`px-3 py-1 ${value ? "bg-primary text-primary-foreground" : "bg-background"}`} onClick={() => onChange(true)}>Yes</button>
      </div>
    </div>
  );
}