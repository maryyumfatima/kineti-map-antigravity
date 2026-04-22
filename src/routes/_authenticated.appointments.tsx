import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/appointments")({
  component: AppointmentsPage,
});

function AppointmentsPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  );
}
