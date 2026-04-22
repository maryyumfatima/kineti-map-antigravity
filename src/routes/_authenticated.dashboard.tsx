import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Users, Star, Wallet, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

interface SessionRow {
  id: string;
  patient_name: string | null;
  scheduled_at: string | null;
  status: string | null;
}

interface FeedbackRow {
  id: string;
  patient_name: string | null;
  score: number | null;
  created_at: string | null;
}

interface Stats {
  todaySessions: number;
  activePatients: number;
  avgFeedback: number | null;
  unpaidSessions: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="relative overflow-hidden">
      <Icon className="absolute right-5 top-5 size-6 text-accent" />
      <div className="font-display text-4xl font-bold text-primary">{value}</div>
      <div className="mt-2 text-sm font-medium text-foreground">{label}</div>
    </Card>
  );
}

function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    todaySessions: 0,
    activePatients: 0,
    avgFeedback: null,
    unpaidSessions: 0,
  });
  const [todayList, setTodayList] = useState<SessionRow[]>([]);
  const [lowScores, setLowScores] = useState<FeedbackRow[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const today = new Date();
      const startISO = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endISO = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const [sessionsRes, patientsRes, feedbackRes, unpaidRes, lowRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, patient_name, scheduled_at, status")
          .gte("scheduled_at", startISO)
          .lt("scheduled_at", endISO)
          .order("scheduled_at", { ascending: true }),
        supabase.from("patients").select("id", { count: "exact", head: true }),
        supabase.from("feedback").select("score"),
        supabase
          .from("sessions")
          .select("id", { count: "exact", head: true })
          .eq("paid", false),
        supabase
          .from("feedback")
          .select("id, patient_name, score, created_at")
          .lte("score", 6)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      if (!active) return;

      const todaySessions = sessionsRes.data ?? [];
      const feedbackScores = (feedbackRes.data ?? []) as { score: number | null }[];
      const validScores = feedbackScores.map((f) => f.score).filter((s): s is number => typeof s === "number");
      const avg =
        validScores.length > 0
          ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
          : null;

      setStats({
        todaySessions: todaySessions.length,
        activePatients: patientsRes.count ?? 0,
        avgFeedback: avg,
        unpaidSessions: unpaidRes.count ?? 0,
      });
      setTodayList(todaySessions as SessionRow[]);
      setLowScores((lowRes.data ?? []) as FeedbackRow[]);
    })();
    return () => {
      active = false;
    };
  }, []);

  const updateSessionStatus = async (id: string, status: "completed" | "no_show") => {
    await supabase.from("sessions").update({ status }).eq("id", id);
    setTodayList((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Today's overview at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Sessions" value={stats.todaySessions} icon={CalendarDays} />
        <StatCard label="Active Patients" value={stats.activePatients} icon={Users} />
        <StatCard
          label="Avg Feedback Score"
          value={stats.avgFeedback === null ? "—" : stats.avgFeedback.toFixed(1)}
          icon={Star}
        />
        <StatCard label="Unpaid Sessions" value={stats.unpaidSessions} icon={Wallet} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold text-foreground">Today's Sessions</h2>
          <div className="mt-4 divide-y divide-border">
            {todayList.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No sessions scheduled today.
              </p>
            ) : (
              todayList.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {s.patient_name ?? "Unknown patient"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.scheduled_at
                        ? new Date(s.scheduled_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                      {s.status && s.status !== "scheduled" ? ` • ${s.status}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateSessionStatus(s.id, "completed")}
                      disabled={s.status === "completed"}
                    >
                      <CheckCircle2 className="size-4" />
                      Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateSessionStatus(s.id, "no_show")}
                      disabled={s.status === "no_show"}
                    >
                      <XCircle className="size-4" />
                      No-Show
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            <h2 className="font-display text-lg font-semibold text-foreground">Low Score Alerts</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Feedback with score ≤ 6.</p>
          <div className="mt-4 divide-y divide-border">
            {lowScores.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No low scores. 🎉</p>
            ) : (
              lowScores.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {f.patient_name ?? "Anonymous"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {f.created_at ? new Date(f.created_at).toLocaleDateString() : ""}
                    </div>
                  </div>
                  <div className="rounded-md bg-destructive/10 px-2.5 py-1 text-sm font-semibold text-destructive">
                    {f.score ?? "—"}/10
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
