import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/billing")({
  component: () => (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Current plan card and plan comparison table coming next.
        </p>
      </div>
      <Card>
        <p className="text-sm text-muted-foreground">This page will be built in the next step.</p>
      </Card>
    </div>
  ),
});
