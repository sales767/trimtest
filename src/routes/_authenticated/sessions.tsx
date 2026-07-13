import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "./route";

export const Route = createFileRoute("/_authenticated/sessions")({
  component: SessionsPage,
});

function SessionsPage() {
  return (
    <div>
      <PageHeader
        title="Measurement sessions"
        description="Recorded measurements, deviations against factory data, and shareable protocols."
      />
      <div className="p-8">
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">Coming in phase 2.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Once a wing model has its linemap, start a session and record measurements line by line.
          </p>
        </div>
      </div>
    </div>
  );
}