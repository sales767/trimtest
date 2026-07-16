import { createFileRoute, Link } from "@tanstack/react-router";
import { Gauge } from "lucide-react";

export const Route = createFileRoute("/vision")({
  head: () => ({
    meta: [
      { title: "Vision · Trim test" },
      { name: "description", content: "Why this tool exists: measurable trust in every wing that leaves the workshop." },
    ],
  }),
  component: VisionPage,
});

function VisionPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-6 py-16 prose prose-neutral dark:prose-invert">
        <h1 className="text-4xl font-semibold tracking-tight">Vision</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          A paraglider is a load-bearing textile. Over time its lines shrink, stretch, and drift out of trim.
          Pilots deserve tools that turn that drift into numbers — visible, comparable, actionable numbers.
        </p>
        <h2 className="mt-10 text-xl font-semibold">Measurable trust</h2>
        <p className="mt-3 text-muted-foreground">
          Every wing that leaves the workshop should carry a signed protocol: which lines were measured, how they
          compared to factory spec, and what loops were adjusted. That protocol is not marketing — it is receipt.
        </p>
        <h2 className="mt-10 text-xl font-semibold">A complement, not a replacement</h2>
        <p className="mt-3 text-muted-foreground">
          This app estimates. Estimates from partial data can guide a technician; they cannot certify airworthiness.
          The final call always belongs to a qualified professional with the wing on the bench.
        </p>
      </main>
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-semibold"><Gauge className="h-5 w-5 text-primary" /> Trim test</Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link to="/vision" className="hover:text-foreground">Vision</Link>
          <Link to="/manual" className="hover:text-foreground">Manual</Link>
          <Link to="/faq" className="hover:text-foreground">FAQ</Link>
          <Link to="/feed" className="hover:text-foreground">Feed</Link>
        </nav>
      </div>
    </header>
  );
}