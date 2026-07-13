import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "./route";
import { Layers, Plane, ClipboardList } from "lucide-react";

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
    { to: "/wings", label: "Wings", value: data.wings, icon: Plane },
    { to: "/sessions", label: "Measurement sessions", value: data.sessions, icon: ClipboardList },
  ] as const;
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of the Niviuk internal measurement database."
      />
      <div className="p-8 grid gap-4 md:grid-cols-3">
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
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold">Quick start</h2>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Create a wing model (brand, name, size, cells).</li>
            <li>Add the factory linemap manually or import a CSV.</li>
            <li>Register the physical wing by serial number.</li>
            <li>Open a measurement session and record real values.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}