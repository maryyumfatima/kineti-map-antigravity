import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Users, Star, Wallet, CheckCircle2, XCircle, AlertTriangle, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { AISOAPNoteModal } from "@/components/AISOAPNoteModal";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

interface SessionRow {
  id: string;
  patients?: { full_name: string | null } | null;
  appointment_time: string | null;
  status: string | null;
}

interface FeedbackRow {
  id: string;
  patients?: { full_name: string | null } | null;
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
  const [soapNotes, setSoapNotes] = useState<Record<string, boolean>>({});
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [draftData, setDraftData] = useState<any>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const today = new Date();
      const startISO = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endISO = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: cu } = await supabase
        .from("clinic_users")
        .select("clinic_id")
        .eq("auth_user_id", user.id)
        .single();
      const clinicId = cu?.clinic_id;

      if (!clinicId) return;

      const [sessionsRes, patientsRes, feedbackRes, unpaidRes, lowRes, soapNotesRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, patients(full_name)")
          .eq("clinic_id", clinicId)
          .gte("appointment_time", startISO)
          .lt("appointment_time", endISO)
          .order("appointment_time", { ascending: true }),
        supabase
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("status_tag", "active")
          .eq("is_deleted", false),
        supabase.from("feedback").select("score").eq("clinic_id", clinicId),
        supabase
          .from("cash_ledger")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("payment_status", "unpaid"),
        supabase
          .from("feedback")
          .select("*, patients(full_name)")
          .eq("clinic_id", clinicId)
          .lte("score", 6)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase.from("soap_notes").select("booking_id, is_ai_generated").eq("clinic_id", clinicId),
      ]);

      if (!active) return;

      const todaySessions = sessionsRes.data ?? [];
      const feedbackScores = (feedbackRes.data ?? []) as { score: number | null }[];
      const validScores = feedbackScores.map((f) => f.score).filter((s): s is number => typeof s === "number");
      const avg =
        validScores.length > 0
          ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
          : null;

      const notes = (soapNotesRes?.data ?? []).reduce((acc: any, note: any) => {
        if (note.is_ai_generated) acc[note.booking_id] = true;
        return acc;
      }, {} as Record<string, boolean>);

      setStats({
        todaySessions: todaySessions.length,
        activePatients: patientsRes.count ?? 0,
        avgFeedback: avg,
        unpaidSessions: unpaidRes.count ?? 0,
      });
      setTodayList(todaySessions as SessionRow[]);
      setLowScores((lowRes.data ?? []) as FeedbackRow[]);
      setSoapNotes(notes);
    })();
    return () => {
      active = false;
    };
  }, []);

  const updateSessionStatus = async (id: string, status: "completed" | "no_show") => {
    await supabase.from("bookings").update({ status }).eq("id", id);
    setTodayList((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));

    if (status === "completed") {
      try {
        const { data: booking } = await supabase
          .from("bookings")
          .select("clinic_id, patient_id, pain_data, appointment_type")
          .eq("id", id)
          .single();

        if (!booking) return;

        const { data: patient } = await supabase
          .from("patients")
          .select("primary_complaint")
          .eq("id", booking.patient_id)
          .single();

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: "llama3-8b-8192",
            messages: [
              {
                role: "user",
                content: `You are a physiotherapy clinical assistant. Generate a professional SOAP note based on:
                
                Primary complaint: ${patient?.primary_complaint || ""}
                Pain areas and severity: ${JSON.stringify(booking.pain_data)}
                Session type: ${booking.appointment_type}
                
                Return ONLY this JSON, nothing else:
                {
                  "subjective": "...",
                  "objective": "...",
                  "assessment": "...",
                  "plan": "..."
                }`
              }
            ],
            max_tokens: 500
          })
        });

        if (!response.ok) return;
        const result = await response.json();
        const content = result.choices?.[0]?.message?.content;
        if (!content) return;

        let parsed;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
        } catch {
          return;
        }

        const { data: draft, error } = await supabase
          .from("ai_soap_drafts")
          .insert({
            booking_id: id,
            clinic_id: booking.clinic_id,
            patient_id: booking.patient_id,
            draft_subjective: parsed.subjective || "",
            draft_objective: parsed.objective || "",
            draft_assessment: parsed.assessment || "",
            draft_plan: parsed.plan || "",
          })
          .select()
          .single();

        if (error || !draft) return;
        setDraftData(draft);
        setAiModalOpen(true);
      } catch (e) {
        // fail silently
      }
    }
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
                      {s.patients?.full_name ?? "Unknown patient"}
                      {soapNotes[s.id] && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                          AI ✨
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.appointment_time
                        ? new Date(s.appointment_time).toLocaleTimeString([], {
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
                      {f.patients?.full_name ?? "Anonymous"}
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
      <AISOAPNoteModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        draftData={draftData}
        onSaved={() => {
          if (draftData) {
            setSoapNotes((prev) => ({ ...prev, [draftData.booking_id]: true }));
          }
        }}
      />
    </div>
  );
}
