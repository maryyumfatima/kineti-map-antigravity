import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, loading, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Patient Portal</h1>
        <p className="mt-3 text-muted-foreground">
          Securely manage your patient data with role-based access.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
