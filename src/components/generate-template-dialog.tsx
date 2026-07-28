import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateStandardTemplate } from "@/lib/models.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const GROUPS = ["A", "B", "C", "D", "BR", "STAB"] as const;
type G = (typeof GROUPS)[number];

/**
 * Builds a full symmetric left/right measuring template for a wing model so a
 * technician always has a sheet to measure into, even before factory data is
 * imported. Factory values stay editable afterwards on the model page.
 */
export function GenerateTemplateDialog({
  modelId,
  open,
  onOpenChange,
  onDone,
}: {
  modelId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [main, setMain] = useState("6800");
  const [tol, setTol] = useState("10");
  const [groupDrop, setGroupDrop] = useState("150");
  const [pointDrop, setPointDrop] = useState("30");
  const [points, setPoints] = useState<Record<G, string>>({ A: "4", B: "4", C: "3", D: "0", BR: "2", STAB: "0" });

  const gen = useMutation({
    mutationFn: () =>
      generateStandardTemplate({
        data: {
          model_id: modelId,
          replace: true,
          main_length_mm: Number(main) || 6800,
          tolerance_mm: Number(tol) || 10,
          group_drop_mm: Number(groupDrop) || 0,
          point_drop_mm: Number(pointDrop) || 0,
          points: Object.fromEntries(GROUPS.map((g) => [g, Number(points[g]) || 0])) as Record<G, number>,
        },
      }),
    onSuccess: (r) => {
      qc.invalidateQueries();
      onOpenChange(false);
      toast.success(`Template created · ${r.count} lines`);
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate measuring template</DialogTitle>
          <DialogDescription>
            Creates a symmetric left/right sheet for this model. Factory lengths are seeded from the
            values below and can be corrected line by line afterwards.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Main line A1 (mm)</Label>
            <Input type="number" value={main} onChange={(e) => setMain(e.target.value)} />
          </div>
          <div>
            <Label>Tolerance (± mm)</Label>
            <Input type="number" value={tol} onChange={(e) => setTol(e.target.value)} />
          </div>
          <div>
            <Label>Drop per row (mm)</Label>
            <Input type="number" value={groupDrop} onChange={(e) => setGroupDrop(e.target.value)} />
          </div>
          <div>
            <Label>Drop per point (mm)</Label>
            <Input type="number" value={pointDrop} onChange={(e) => setPointDrop(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Attachment points per side</Label>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {GROUPS.map((g) => (
              <div key={g}>
                <div className="text-center text-[10px] uppercase tracking-widest text-muted-foreground">{g}</div>
                <Input
                  type="number"
                  min={0}
                  className="text-center"
                  value={points[g]}
                  onChange={(e) => setPoints({ ...points, [g]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => gen.mutate()} disabled={gen.isPending}>
            {gen.isPending ? "Generating…" : "Generate template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}