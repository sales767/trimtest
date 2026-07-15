import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "./route";
import { Layers, ClipboardList, Ruler, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const statsQuery = queryOptions({
  queryKey: ["dashboard-stats"],
  queryFn: async () => {
    const [m, w, s] = await Promise.all([
      supabase.from("wing_models").select("id", { count: "exact", head: true }),
      supabase.from("wings").select("id", { count: "exact", head: true }),
      supabase.from("measurement_sessions").select("id", { count: "exact", head: true }),
    ]);
    return { models: m.count ?? 0, wings: w.count ?? 0, sessions: s.count ?? 0 };
  },
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  loader: ({ context }) => context.queryClient.ensureQueryData(statsQuery),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function Dashboard() {
  const { data } = useSuspenseQuery(statsQuery);
  const cards = [
    { to: "/models", label: "Wing models", value: data.models, icon: Layers },
    { to: "/sessions", label: "Measurement sessions", value: data.sessions, icon: ClipboardList },
  ] as const;
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of the Niviuk internal measurement database."
      />
      <div className="p-8">
        <Link
          to="/sessions"
          className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 p-6 hover:bg-primary/10 transition-colors"
          style={{ boxShadow: "var(--shadow-panel)" }}
        >
          <div className="flex items-center gap-4">
            <Ruler className="h-8 w-8 text-primary" />
            <div>
              <div className="text-lg font-semibold">Measure a wing</div>
              <div className="text-sm text-muted-foreground">
                Open Measurements → New measurement. Pick the model, enter the serial number,
                fill in each line length and see deviations + suggested loops in real time.
              </div>
            </div>
          </div>
          <Button variant="default" size="sm" asChild>
            <span>Start <ArrowRight className="h-4 w-4 ml-1" /></span>
          </Button>
        </Link>
      </div>
      <div className="px-8 grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="rounded-lg border border-border bg-card p-6 hover:border-primary transition-colors"
            style={{ boxShadow: "var(--shadow-panel)" }}
          >
            <div className="flex items-center justify-between">
              <c.icon className="h-5 w-5 text-primary" />
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Total
              </span>
            </div>
            <div className="mt-6 text-4xl font-semibold">{c.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="px-8 pb-8">
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold">Quick start</h2>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li><Link to="/models" className="underline">Create a wing model</Link> and add its factory linemap (per-line factory length + material).</li>
            <li>Go to <Link to="/sessions" className="underline">Measurements</Link> and press <b>New measurement</b>: pick model + serial number.</li>
            <li>Type each measured length. Deviations appear live, colour-coded by tolerance.</li>
            <li>For out-of-tolerance lines with a material assigned, the app suggests which loop to apply.</li>
            <li>Mark the session <b>Complete</b>, then <b>Publish</b> to get a shareable protocol link.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}