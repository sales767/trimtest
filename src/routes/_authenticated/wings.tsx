import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "./route";

export const Route = createFileRoute("/_authenticated/wings")({
  component: WingsPage,
});

function WingsPage() {
  return (
    <div>
      <PageHeader
        title="Wings"
        description="Physical wings registered by serial number."
      />
      <div className="p-8">
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">Coming in phase 2.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Register wings by serial number and link them to a factory model.
          </p>
        </div>
      </div>
    </div>
  );
}