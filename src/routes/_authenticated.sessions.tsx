import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/sessions")({
  component: () => (
    <PlaceholderPage
      title="Sessions"
      description="Full sessions table with Mark Complete / No-Show and Add Session modal coming next."
    />
  ),
});

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <p className="text-sm text-muted-foreground">This page will be built in the next step.</p>
      </Card>
    </div>
  );
}
