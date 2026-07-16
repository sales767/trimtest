import { createFileRoute, Link } from "@tanstack/react-router";
import { Gauge } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ · Trim test" },
      { name: "description", content: "Common questions about the paraglider line-measurement workflow." },
    ],
  }),
  component: FaqPage,
});

const items = [
  { q: "How accurate is the deviation number?", a: "As accurate as your laser meter plus your reference. The offset field lets you compensate a known meter bias." },
  { q: "What does 'implausible' mean?", a: "A reading whose deviation exceeds 4× the effective tolerance. Usually a mis-hooked laser point or a mis-tensioned line. Re-measure or accept it explicitly." },
  { q: "Can I re-measure only part of a wing?", a: "Yes — start a new session and link it to the previous one. Unmeasured lines carry over from the previous session for the comparison view." },
  { q: "Who can see a published protocol?", a: "Anyone with the link. The public feed shows recent published protocols; ‘Publish anonymously’ hides the serial in that feed." },
  { q: "Does this replace a professional trim check?", a: "No. It is a decision-support tool. Airworthiness always rests with a qualified technician." },
];

function FaqPage() {
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
        <h1 className="text-4xl font-semibold tracking-tight">FAQ</h1>
        <Accordion type="single" collapsible className="mt-8">
          {items.map((it, i) => (
            <AccordionItem key={i} value={String(i)}>
              <AccordionTrigger className="text-left">{it.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{it.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
    </div>
  );
}