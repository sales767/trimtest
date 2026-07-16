import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listPublicFeed } from "@/lib/public-feed.functions";
import { Gauge } from "lucide-react";

const feedQuery = queryOptions({ queryKey: ["public-feed"], queryFn: () => listPublicFeed() });

export const Route = createFileRoute("/feed")({
  loader: ({ context }) => context.queryClient.ensureQueryData(feedQuery),
  head: () => ({
    meta: [
      { title: "Published protocols · Trim test" },
      { name: "description", content: "Anonymised feed of recent measurement protocols published by the Niviuk workshop." },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const { data } = useSuspenseQuery(feedQuery);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold"><Gauge className="h-5 w-5 text-primary" /> Trim test</Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link to="/vision" className="hover:text-foreground">Vision</Link>
            <Link to="/manual" className="hover:text-foreground">Manual</Link>
            <Link to="/faq" className="hover:text-foreground">FAQ</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Published protocols</h1>
        <p className="mt-2 text-sm text-muted-foreground">Latest measurement sessions the workshop has released. Anonymised entries hide the wing serial.</p>
        <div className="mt-8 rounded-lg border border-border bg-card overflow-hidden">
          {data.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">No published protocols yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Model</th>
                  <th className="text-left px-4 py-3 font-medium">Serial</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono">{r.session_date}</td>
                    <td className="px-4 py-3">{r.model}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{r.serial ?? <span className="italic">anonymous</span>}</td>
                    <td className="px-4 py-3 text-right">
                      {r.share_token && (
                        <a href={`/share/${r.share_token}`} className="text-primary hover:underline">Open →</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}