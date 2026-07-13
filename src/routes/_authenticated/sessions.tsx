import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listSessions } from "@/lib/sessions.functions";
import { PageHeader } from "./route";
import { ArrowRight } from "lucide-react";

const sessionsQuery = queryOptions({ queryKey: ["sessions"], queryFn: () => listSessions() });

export const Route = createFileRoute("/_authenticated/sessions")({
  component: SessionsPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(sessionsQuery),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-foreground",
  complete: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  published: "bg-primary/15 text-primary",
};

function SessionsPage() {
  const { data } = useSuspenseQuery(sessionsQuery);
  return (
    <div>
      <PageHeader
        title="Measurement sessions"
        description="Recorded measurements and deviations against factory data."
      />
      <div className="p-8">
        {data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">No sessions yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to <Link to="/wings" className="underline">Wings</Link> and press Measure to start.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Wing</th>
                  <th className="text-left px-4 py-3 font-medium">Model</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => {
                  const wing = s.wing as { serial_number: string; model: { brand: string; name: string; size: string | null } } | null;
                  return (
                    <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3">{s.session_date}</td>
                      <td className="px-4 py-3 font-mono">{wing?.serial_number ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {wing?.model ? `${wing.model.brand} ${wing.model.name}${wing.model.size ? ` · ${wing.model.size}` : ""}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status] ?? ""}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Link to="/sessions/$id" params={{ id: s.id }} className="inline-flex items-center text-primary hover:underline">
                          Open <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}