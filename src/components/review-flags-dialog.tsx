import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type FlaggedRow = {
  line_spec_id: string;
  label: string;
  line_group: string;
  measured: number | null;
  dev: number | null;
  reason: string;
};

export function ReviewFlagsDialog({
  open,
  onOpenChange,
  rows,
  onAcceptAll,
  onFocusLine,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: FlaggedRow[];
  onAcceptAll: () => void;
  onFocusLine: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Review flagged readings
          </DialogTitle>
          <DialogDescription>
            These lines exceed 4× their tolerance. Re-measure or explicitly accept before continuing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No flagged readings 🎉</div>
          ) : (
            rows.map((r) => (
              <button
                key={r.line_spec_id}
                onClick={() => onFocusLine(r.line_spec_id)}
                className="w-full text-left rounded-md border border-border bg-card p-2 hover:bg-muted/40"
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono text-sm">
                    <span className="text-muted-foreground mr-2">{r.line_group}</span>
                    <span className="font-semibold">{r.label}</span>
                  </div>
                  <div className="font-mono text-xs text-amber-600">
                    {r.measured?.toFixed(1) ?? "—"} mm · dev {r.dev !== null ? `${r.dev >= 0 ? "+" : ""}${r.dev.toFixed(1)}` : "—"}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{r.reason}</div>
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep editing</Button>
          <Button onClick={onAcceptAll} disabled={rows.length === 0}>
            Accept and continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}