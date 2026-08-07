import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Gauge, Database, Share2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Niviuk Measure — Paraglider trim testing" },
      {
        name: "description",
        content:
          "Measure paraglider line lengths, compare them against factory specs and get loop corrections — the in-house trim-testing tool at Niviuk.",
      },
      { property: "og:title", content: "Niviuk Measure — Paraglider trim testing" },
      {
        property: "og:description",
        content:
          "Measure paraglider line lengths, compare them against factory specs and get loop corrections.",
      },
      { property: "og:url", content: "https://trimtest.lovable.app/" },
      { name: "twitter:title", content: "Niviuk Measure — Paraglider trim testing" },
      {
        name: "twitter:description",
        content:
          "Measure paraglider line lengths, compare them against factory specs and get loop corrections.",
      },
    ],
    links: [{ rel: "canonical", href: "https://trimtest.lovable.app/" }],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <Gauge className="h-6 w-6 text-primary" />
            <span>Niviuk Measure</span>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden sm:flex gap-4 text-sm text-muted-foreground">
              <Link to="/vision" className="hover:text-foreground">Vision</Link>
              <Link to="/manual" className="hover:text-foreground">Manual</Link>
              <Link to="/faq" className="hover:text-foreground">FAQ</Link>
              <Link to="/feed" className="hover:text-foreground">Feed</Link>
            </nav>
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="mx-auto max-w-6xl px-6 py-24 relative">
          <p className="text-sm font-medium text-primary uppercase tracking-widest">
            Internal tool · Niviuk workshop
          </p>
          <h1 className="mt-4 text-5xl md:text-6xl font-bold tracking-tight max-w-3xl">
            Measure, compare and certify every wing against factory data.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            A precision workbench for our technicians: catalog every model, load
            factory line lengths, record real measurements and generate
            protocols that prove each wing is within spec.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Enter the workshop</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 grid gap-6 md:grid-cols-3">
        {[
          {
            icon: Database,
            title: "Factory database",
            body: "Every Niviuk model with its full linemap (A, B, C, D, brakes, stabilo) and nominal lengths.",
          },
          {
            icon: Gauge,
            title: "Deviation at a glance",
            body: "Enter measured values, see deviation in mm and %, color-coded against tolerance.",
          },
          {
            icon: Share2,
            title: "Shareable protocols",
            body: "Publish a read-only measurement protocol via a signed link — for customers or QA records.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-lg border border-border bg-card p-6"
            style={{ boxShadow: "var(--shadow-panel)" }}
          >
            <f.icon className="h-6 w-6 text-primary" />
            <h2 className="mt-4 font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Internal Niviuk system · Authorized personnel only
        </div>
      </footer>
    </div>
  );
}
