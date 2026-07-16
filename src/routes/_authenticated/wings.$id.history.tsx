import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getWing } from "@/lib/wings.functions";
import { PageHeader } from "./route";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, GitBranch, ExternalLink } from "lucide-react";

const wingQuery = (id: string) =>
  queryOptions({ queryKey: ["wing", id], queryFn: () => getWing({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/wings/$id/history")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(wingQuery(params.id)),
  component: WingHistory,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Wing not found</div>,
});

type Session = { id: string; session_date: string; status: string; notes: string | null };

function WingHistory() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(wingQuery(id));
  const wing = data.wing as {
    serial_number: string;
    model: { brand: string; name: string; size: string | null };
  };
  const sessions = (data.sessions as Session[]).slice().sort((a, b) => a.session_date.localeCompare(b.session_date));

  return (
    <div>
      <PageHeader
        title={`${wing.model.brand} ${wing.model.name}${wing.model.size ? ` · ${wing.model.size}` : ""} · history`}
        description={`SN ${wing.serial_number} · ${sessions.length} session${sessions.length === 1 ? "" : "s"} in chronological order`}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/wings/$id" params={{ id }}>
              <ArrowLeft className="h-4 w-4 mr-2" />Back to wing
            </Link>
          </Button>
        }
      />
      <div className="p-8">
        {sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            No sessions yet.
          </div>
        ) : (
          <ol className="relative border-l border-border ml-4 space-y-4">
            {sessions.map((s, i) => (
              <li key={s.id} className="pl-6 relative">
                <span className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full bg-primary border-2 border-background" />
                <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-xs text-muted-foreground font-mono">#{i + 1}</span>
                      <span className="font-mono">{s.session_date}</span>
                      <span className="inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest bg-muted text-muted-foreground">
                        {s.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">{s.notes ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {i < sessions.length - 1 && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <GitBranch className="h-3 w-3" /> continues
                      </span>
                    )}
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/sessions/$id" params={{ id: s.id }}>
                        Open <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}