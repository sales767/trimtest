import { createFileRoute, Link } from "@tanstack/react-router";
import { Gauge } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/manual")({
  head: () => ({
    meta: [
      { title: "Manual — How to run a trim test" },
      { name: "description", content: "How to set up, capture, review and publish a paraglider line-measurement session." },
      { property: "og:title", content: "Manual — How to run a trim test" },
      { property: "og:description", content: "Step-by-step: prepare the wing, capture line lengths, review deviations and publish the protocol." },
      { property: "og:url", content: "https://trimtest.lovable.app/manual" },
    ],
    links: [{ rel: "canonical", href: "https://trimtest.lovable.app/manual" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How to run a paraglider trim test with Niviuk Measure",
          description:
            "Prepare the wing, capture every line length, review deviations against factory specs and publish the protocol.",
          step: sections.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.title,
            text: s.body,
            url: `https://trimtest.lovable.app/manual#${s.id}`,
          })),
        }),
      },
    ],
  }),
  component: ManualPage,
});

const sections = [
  {
    id: "setup",
    title: "1. Prepare the wing and the workbench",
    body: "Lay the wing on a flat, dry surface. Tension every line group before you start. Verify your laser distance meter is warm, referenced against a known length, and that its bluetooth offset (if any) matches the one saved in your profile.",
  },
  {
    id: "session",
    title: "2. Start a measurement session",
    body: "From Measurements press New. Pick the wing model, type or scan the serial, and choose the capture order (rows, columns, sections). If you know the wing needs a tighter tolerance than factory spec, override it here.",
  },
  {
    id: "capture",
    title: "3. Capture line by line",
    body: "Focus auto-advances following the order you picked. If a reading looks implausible the row is flagged — re-measure or accept it explicitly. You can also import an XLSX with two columns (label, measured mm) prepared elsewhere.",
  },
  {
    id: "review",
    title: "4. Review, adjust loops, finish",
    body: "Open the AoI/symmetry view to see where the wing sits relative to factory. If a group drifts, the app suggests which stock loop shortens the difference. Persist accepted changes into the wing loop state so the next session starts from the true installed state.",
  },
  {
    id: "publish",
    title: "5. Publish the protocol",
    body: "Publishing mints a share token and a printable protocol. The link is public but content-only; personal notes stay in the workshop. Anonymous publishes hide the serial in the feed while keeping the direct link accurate.",
  },
];

function ManualPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
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
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-semibold tracking-tight">Manual</h1>
        <p className="mt-3 text-muted-foreground">The full workshop flow, from tensioning the wing to publishing a protocol.</p>
        <Accordion type="single" collapsible className="mt-8">
          {sections.map((s) => (
            <AccordionItem key={s.id} value={s.id}>
              <AccordionTrigger className="text-left">{s.title}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{s.body}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
    </div>
  );
}