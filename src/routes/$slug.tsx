import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { BodyMap, type PainPoint, type PainData } from "@/components/BodyMap";

type Clinic = {
  id: string;
  name: string | null;
  slug: string | null;
  logo_url: string | null;
  brand_color: string | null;
  bio: string | null;
  booking_page_mode: string | null;
  whatsapp_number: string | null;
};

const RESERVED_SLUGS = new Set([
  "login",
  "dashboard",
  "patients",
  "sessions",
  "availability",
  "feedback",
  "revenue",
  "branding",
  "billing",
  "settings",
  "appointments",
  "api",
  "_authenticated",
]);

export const Route = createFileRoute("/$slug")({
  beforeLoad: ({ params }) => {
    if (RESERVED_SLUGS.has(params.slug)) {
      throw new Error("reserved");
    }
  },
  component: PublicBookingPage,
});

const TOTAL_STEPS = 5;

const step1Schema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(120),
  whatsapp_number: z
    .string()
    .trim()
    .min(7, "Enter a valid WhatsApp number")
    .max(20)
    .regex(/^[+\d\s-]+$/, "Digits, spaces, + and - only"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  email: z
    .string()
    .trim()
    .max(255)
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
  guardian_name: z.string().trim().optional(),
  guardian_whatsapp: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  if (data.date_of_birth) {
    const dob = new Date(data.date_of_birth);
    const age = (new Date().getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 16) {
      if (!data.guardian_name || data.guardian_name.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["guardian_name"],
          message: "Guardian name is required for patients under 16",
        });
      }
      if (!data.guardian_whatsapp || data.guardian_whatsapp.length < 7) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["guardian_whatsapp"],
          message: "Guardian WhatsApp is required for patients under 16",
        });
      }
    }
  }
});

type Step1 = z.infer<typeof step1Schema>;

type RedFlagKey =
  | "weight_loss"
  | "bladder_bowel"
  | "numbness"
  | "chest_breath";
type RedFlagAnswer = "yes" | "no" | "unsure";

const RED_FLAGS: { key: RedFlagKey; label: string }[] = [
  { key: "weight_loss", label: "Any unexplained weight loss?" },
  { key: "bladder_bowel", label: "Any bladder or bowel changes?" },
  { key: "numbness", label: "Any numbness or tingling?" },
  { key: "chest_breath", label: "Any chest pain or breathlessness?" },
];

type MedicalField = "surgeries" | "conditions" | "medications" | "allergies" | "occupation";
const MEDICAL_FIELDS: { key: MedicalField; label: string; placeholder: string }[] = [
  { key: "surgeries", label: "Past surgeries", placeholder: "e.g. ACL reconstruction 2019" },
  { key: "conditions", label: "Ongoing conditions", placeholder: "e.g. asthma, diabetes" },
  { key: "medications", label: "Current medications", placeholder: "e.g. ibuprofen as needed" },
  { key: "allergies", label: "Allergies", placeholder: "e.g. penicillin, latex" },
  { key: "occupation", label: "Occupation", placeholder: "e.g. office worker, nurse" },
];

function generateSlots(): { iso: string; label: string; day: string }[] {
  const slots: { iso: string; label: string; day: string }[] = [];
  const now = new Date();
  for (let d = 1; d <= 5; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    if (day.getDay() === 0) continue; // skip Sundays
    for (const hour of [9, 11, 14, 16]) {
      const slot = new Date(day);
      slot.setHours(hour, 0, 0, 0);
      slots.push({
        iso: slot.toISOString(),
        label: slot.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        day: slot.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }),
      });
    }
  }
  return slots;
}

function PublicBookingPage() {
  console.log("PublicBookingPage is loading route /$slug");
  const { slug } = Route.useParams();
  const navigate = useNavigate();

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loadingClinic, setLoadingClinic] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingClinic(true);
      setNotFound(false);
      setClinic(null);

      if (!slug) {
        console.log("Slug is undefined");
        setNotFound(true);
        setLoadingClinic(false);
        return;
      }

      const normalizedSlug = slug.trim().toLowerCase();
      console.log("Slug from URL:", normalizedSlug);
      console.log(
        "Querying Supabase: from('clinics').select('*').eq('slug', '" +
          normalizedSlug +
          "').maybeSingle()",
      );

      const { data, error, status } = await supabase
        .from("clinics")
        .select("*")
        .eq("slug", normalizedSlug)
        .maybeSingle();

      console.log("data:", data, "error:", error);

      if (!active) return;

      console.log("Supabase response status:", status, "error:", error, "data:", data);

      if (error && error.code !== "PGRST116") {
        console.log("Clinic fetch error:", error.message);
      }
      if (!data) {
        console.log("No clinic found in DB for slug:", normalizedSlug);
        setNotFound(true);
      } else {
        console.log("Clinic loaded:", data);
        setClinic(data as Clinic);
      }
      setLoadingClinic(false);
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  if (loadingClinic) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (notFound || !clinic) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md text-center">
          <h1 className="font-display text-2xl font-bold">Clinic not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The booking link you used isn't active. Please check with your clinic.
          </p>
          <Button className="mt-4" onClick={() => navigate({ to: "/" })}>
            Go home
          </Button>
        </Card>
      </main>
    );
  }

  const brand = clinic.brand_color || "#006D77";

  return (
    <main className="min-h-screen bg-background pb-12">
      <ClinicHeader clinic={clinic} brand={brand} />
      {clinic.booking_page_mode === "closed" ? (
        <ClosedNotice clinic={clinic} />
      ) : (
        <BookingFlow clinic={clinic} brand={brand} />
      )}
    </main>
  );
}

function ClinicHeader({ clinic, brand }: { clinic: Clinic; brand: string }) {
  return (
    <header
      className="border-b border-border px-4 py-6"
      style={{ background: `linear-gradient(180deg, ${brand}14, transparent)` }}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-4">
        {clinic.logo_url ? (
          <img
            src={clinic.logo_url}
            alt={`${clinic.name ?? "Clinic"} logo`}
            className="h-14 w-14 rounded-lg border border-border bg-card object-cover"
          />
        ) : (
          <div
            className="flex h-14 w-14 items-center justify-center rounded-lg font-display text-xl font-bold text-white"
            style={{ background: brand }}
          >
            {(clinic.name ?? "C").slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <h1 
            className="font-display text-2xl font-bold leading-tight tracking-tight"
            style={{ color: brand }}
          >
            {clinic.name ?? "Book your appointment"}
          </h1>
          {clinic.bio && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{clinic.bio}</p>
          )}
        </div>
      </div>
    </header>
  );
}

function ClosedNotice({ clinic }: { clinic: Clinic }) {
  return (
    <div className="mx-auto mt-8 max-w-2xl px-4">
      <Card className="text-center">
        <h2 className="font-display text-xl font-bold">Online bookings are paused</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This clinic is not accepting online bookings at the moment. Please contact us directly.
        </p>
        {clinic.whatsapp_number && (
          <Button asChild className="mt-4">
            <a
              href={`https://wa.me/${clinic.whatsapp_number.replace(/[^\d]/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp {clinic.whatsapp_number}
            </a>
          </Button>
        )}
      </Card>
    </div>
  );
}

type Stage = "form" | "otp" | "confirmed";

function BookingFlow({ clinic, brand }: { clinic: Clinic; brand: string }) {
  const slots = useMemo(generateSlots, []);
  const [stage, setStage] = useState<Stage>("form");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1
  const [identity, setIdentity] = useState<Step1>({
    full_name: "",
    whatsapp_number: "",
    date_of_birth: "",
    email: "",
    guardian_name: "",
    guardian_whatsapp: "",
  });
  const [identityErrors, setIdentityErrors] = useState<Partial<Record<keyof Step1, string>>>({});
  const [honeypot, setHoneypot] = useState("");

  // Step 2
  const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
  const [painSummary, setPainSummary] = useState<PainData>({});
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Step 3
  const [medical, setMedical] = useState<Record<MedicalField, string>>({
    surgeries: "",
    conditions: "",
    medications: "",
    allergies: "",
    occupation: "",
  });
  const [medicalSkip, setMedicalSkip] = useState<Record<MedicalField, boolean>>({
    surgeries: false,
    conditions: false,
    medications: false,
    allergies: false,
    occupation: false,
  });

  // Step 4
  const [redFlags, setRedFlags] = useState<Record<RedFlagKey, RedFlagAnswer | null>>({
    weight_loss: null,
    bladder_bowel: null,
    numbness: null,
    chest_breath: null,
  });

  // Step 5
  const [consents, setConsents] = useState({ data: false, whatsapp: false, marketing: false });

  // OTP
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const validateStep = (n: number): boolean => {
    setSubmitError(null);
    if (n === 1) {
      const result = step1Schema.safeParse(identity);
      if (!result.success) {
        const errs: Partial<Record<keyof Step1, string>> = {};
        for (const issue of result.error.issues) {
          const k = issue.path[0] as keyof Step1;
          if (!errs[k]) errs[k] = issue.message;
        }
        setIdentityErrors(errs);
        return false;
      }
      setIdentityErrors({});
      return true;
    }
    if (n === 2) {
      if (!selectedSlot) {
        setSubmitError("Please pick an appointment time.");
        return false;
      }
      return true;
    }
    if (n === 4) {
      const missing = RED_FLAGS.some((rf) => redFlags[rf.key] === null);
      if (missing) {
        setSubmitError("Please answer all four safety questions.");
        return false;
      }
      return true;
    }
    if (n === 5) {
      if (!consents.data) {
        setSubmitError("Data processing consent is required to book.");
        return false;
      }
      return true;
    }
    return true;
  };

  const next = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };
  const back = () => {
    setSubmitError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateStep(5)) return;
    if (honeypot) return; // bot
    // Move to OTP screen — OTP is mocked client-side as 123456
    setOtp("");
    setOtpError(null);
    setStage("otp");
  };

  const finalizeBooking = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // 1) Upsert patient by (phone_number, clinic_id)
      const phone = identity.whatsapp_number.trim();
      const { data: patient, error: patientErr } = await supabase
        .from("patients")
        .upsert(
          {
            clinic_id: clinic.id,
            full_name: identity.full_name.trim(),
            phone_number: phone,
            email: identity.email?.trim() || null,
            date_of_birth: identity.date_of_birth,
            guardian_name: identity.guardian_name?.trim() || null,
            guardian_whatsapp: identity.guardian_whatsapp?.trim() || null,
          },
          { onConflict: "phone_number,clinic_id" },
        )
        .select("id")
        .single();
      if (patientErr || !patient) throw new Error(patientErr?.message ?? "Could not save patient");

      // 2) Insert booking
      const medicalPayload: Record<string, string> = {};
      for (const f of MEDICAL_FIELDS) {
        if (medicalSkip[f.key]) medicalPayload[f.key] = "prefer_not_to_say";
        else if (medical[f.key].trim()) medicalPayload[f.key] = medical[f.key].trim();
      }
      const { data: booking, error: bookingErr } = await supabase
        .from("bookings")
        .insert({
          clinic_id: clinic.id,
          patient_id: patient.id,
          scheduled_at: selectedSlot,
          pain_data: { summary: painSummary, points: painPoints },
          red_flags: { ...redFlags, medical: medicalPayload },
          status: "pending",
        })
        .select("id")
        .single();
      if (bookingErr || !booking) throw new Error(bookingErr?.message ?? "Could not save booking");

      // 3) Insert consent records (one row per type)
      const consentRows = [
        { consent_type: "data", granted: consents.data },
        { consent_type: "whatsapp", granted: consents.whatsapp },
        { consent_type: "marketing", granted: consents.marketing },
      ].map((c) => ({ ...c, clinic_id: clinic.id, patient_id: patient.id }));
      const { error: consentErr } = await supabase.from("consent_records").insert(consentRows);
      if (consentErr) throw new Error(consentErr.message);

      setBookingId(booking.id);
      setStage("confirmed");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    if (otp.trim() !== "123456") {
      setOtpError("That code didn't match. Hint: use 123456 in this preview.");
      return;
    }
    await finalizeBooking();
  };

  if (stage === "confirmed") {
    return (
      <ConfirmedScreen
        clinic={clinic}
        brand={brand}
        slotIso={selectedSlot}
        bookingId={bookingId}
      />
    );
  }

  if (stage === "otp") {
    return (
      <div className="mx-auto mt-6 max-w-2xl px-4">
        <Card>
          <h2 className="font-display text-xl font-bold">Verify your WhatsApp</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{identity.whatsapp_number}</span>. Enter
            it below to confirm your booking.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Preview mode — use code <span className="font-mono font-semibold">123456</span>.
          </p>
          <form onSubmit={handleOtpSubmit} className="mt-4 space-y-3">
            <Input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="text-center text-2xl tracking-[0.5em]"
            />
            {otpError && <p className="text-sm text-destructive">{otpError}</p>}
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStage("form")}>
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting} style={{ background: brand }}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & confirm"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-4 max-w-2xl px-4">
      {/* Intro */}
      <p className="mb-4 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-foreground">
        This helps your physiotherapist prepare. It takes under 5 minutes. You can skip anything you
        prefer not to answer. Your physio will do their own full assessment.
      </p>

      {/* Progress */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Step {step} of {TOTAL_STEPS}</span>
          <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
        </div>
        <Progress value={(step / TOTAL_STEPS) * 100} />
      </div>

      <form onSubmit={handleSubmitForm}>
        <Card>
          {step === 1 && (
            <Step1Form
              value={identity}
              errors={identityErrors}
              onChange={setIdentity}
              honeypot={honeypot}
              onHoneypot={setHoneypot}
            />
          )}
          {step === 2 && (
            <Step2Form
              painPoints={painPoints}
              onPainChange={(pts, summary) => {
                setPainPoints(pts);
                setPainSummary(summary);
              }}
              slots={slots}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
              brand={brand}
            />
          )}
          {step === 3 && (
            <Step3Form
              medical={medical}
              skip={medicalSkip}
              onChange={setMedical}
              onSkip={setMedicalSkip}
            />
          )}
          {step === 4 && (
            <Step4Form value={redFlags} onChange={setRedFlags} brand={brand} />
          )}
          {step === 5 && (
            <Step5Form value={consents} onChange={setConsents} />
          )}

          {submitError && (
            <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={back} disabled={step === 1}>
              Back
            </Button>
            {step < TOTAL_STEPS ? (
              <Button type="button" onClick={next} style={{ background: brand }}>
                Continue
              </Button>
            ) : (
              <Button type="submit" disabled={submitting} style={{ background: brand }}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send verification code"}
              </Button>
            )}
          </div>
        </Card>
      </form>
    </div>
  );
}

// ---------- Step components ----------

function Step1Form({
  value,
  errors,
  onChange,
  honeypot,
  onHoneypot,
}: {
  value: Step1;
  errors: Partial<Record<keyof Step1, string>>;
  onChange: (v: Step1) => void;
  honeypot: string;
  onHoneypot: (v: string) => void;
}) {
  const update = <K extends keyof Step1>(k: K, v: Step1[K]) => onChange({ ...value, [k]: v });
  
  const dobDate = value.date_of_birth ? new Date(value.date_of_birth) : null;
  const age = dobDate ? (new Date().getTime() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000) : null;
  const isMinor = age !== null && age < 16;

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-bold">Your details</h2>
      <div className="space-y-2">
        <Label htmlFor="full_name">Full name *</Label>
        <Input
          id="full_name"
          autoComplete="name"
          value={value.full_name}
          onChange={(e) => update("full_name", e.target.value)}
        />
        {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="whatsapp">WhatsApp number *</Label>
        <Input
          id="whatsapp"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+44 7..."
          value={value.whatsapp_number}
          onChange={(e) => update("whatsapp_number", e.target.value)}
        />
        {errors.whatsapp_number && (
          <p className="text-xs text-destructive">{errors.whatsapp_number}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="dob">Date of birth *</Label>
        <Input
          id="dob"
          type="date"
          value={value.date_of_birth}
          onChange={(e) => update("date_of_birth", e.target.value)}
        />
        {errors.date_of_birth && (
          <p className="text-xs text-destructive">{errors.date_of_birth}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email (optional)</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={value.email}
          onChange={(e) => update("email", e.target.value)}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
      </div>

      {isMinor && (
        <>
          <div className="space-y-2">
            <Label htmlFor="guardian_name">Guardian's Full Name *</Label>
            <Input
              id="guardian_name"
              autoComplete="name"
              value={value.guardian_name || ""}
              onChange={(e) => update("guardian_name", e.target.value)}
            />
            {errors.guardian_name && <p className="text-xs text-destructive">{errors.guardian_name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="guardian_whatsapp">Guardian's WhatsApp *</Label>
            <Input
              id="guardian_whatsapp"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+44 7..."
              value={value.guardian_whatsapp || ""}
              onChange={(e) => update("guardian_whatsapp", e.target.value)}
            />
            {errors.guardian_whatsapp && (
              <p className="text-xs text-destructive">{errors.guardian_whatsapp}</p>
            )}
          </div>
        </>
      )}

      {/* honeypot — hidden from humans */}
      <div aria-hidden="true" style={{ position: "absolute", left: -10000, top: "auto" }}>
        <label>
          Leave this field blank
          <input
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => onHoneypot(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

function Step2Form({
  painPoints,
  onPainChange,
  slots,
  selectedSlot,
  onSelectSlot,
  brand,
}: {
  painPoints: PainPoint[];
  onPainChange: (pts: PainPoint[], summary: PainData) => void;
  slots: { iso: string; label: string; day: string }[];
  selectedSlot: string | null;
  onSelectSlot: (iso: string) => void;
  brand: string;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof slots>();
    for (const s of slots) {
      const list = map.get(s.day) ?? [];
      list.push(s);
      map.set(s.day, list);
    }
    return Array.from(map.entries());
  }, [slots]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold">Where does it hurt?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mark up to a few points so your physio knows where to start.
        </p>
        <div className="mt-4">
          <BodyMap value={painPoints} onChange={onPainChange} />
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-semibold">Pick a time</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose an appointment slot that works for you.
        </p>
        <div className="mt-3 space-y-4">
          {grouped.map(([day, daySlots]) => (
            <div key={day}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {day}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {daySlots.map((s) => {
                  const active = selectedSlot === s.iso;
                  return (
                    <button
                      key={s.iso}
                      type="button"
                      onClick={() => onSelectSlot(s.iso)}
                      className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                      style={
                        active
                          ? { background: brand, color: "#fff", borderColor: brand }
                          : { background: "#fff", color: "var(--foreground)", borderColor: "var(--border)" }
                      }
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step3Form({
  medical,
  skip,
  onChange,
  onSkip,
}: {
  medical: Record<MedicalField, string>;
  skip: Record<MedicalField, boolean>;
  onChange: (m: Record<MedicalField, string>) => void;
  onSkip: (s: Record<MedicalField, boolean>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold">Medical background</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All optional. Skip anything you'd rather not share.
        </p>
      </div>
      {MEDICAL_FIELDS.map((f) => {
        const skipped = skip[f.key];
        return (
          <div key={f.key} className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor={f.key}>{f.label}</Label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={skipped}
                  onCheckedChange={(v) => onSkip({ ...skip, [f.key]: v === true })}
                />
                Prefer not to say
              </label>
            </div>
            {f.key === "occupation" ? (
              <Input
                id={f.key}
                placeholder={f.placeholder}
                disabled={skipped}
                value={skipped ? "" : medical[f.key]}
                onChange={(e) => onChange({ ...medical, [f.key]: e.target.value })}
              />
            ) : (
              <Textarea
                id={f.key}
                placeholder={f.placeholder}
                disabled={skipped}
                value={skipped ? "" : medical[f.key]}
                onChange={(e) => onChange({ ...medical, [f.key]: e.target.value })}
                rows={2}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Step4Form({
  value,
  onChange,
  brand,
}: {
  value: Record<RedFlagKey, RedFlagAnswer | null>;
  onChange: (v: Record<RedFlagKey, RedFlagAnswer | null>) => void;
  brand: string;
}) {
  const set = (k: RedFlagKey, a: RedFlagAnswer) => onChange({ ...value, [k]: a });
  const hasYes = Object.values(value).some((v) => v === "yes");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold">Quick safety check</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A short list to flag anything urgent for your physio.
        </p>
      </div>
      
      {hasYes && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
          Your physio will follow up on this.
        </div>
      )}

      <div className="space-y-3">
        {RED_FLAGS.map((rf) => (
          <div key={rf.key} className="rounded-lg border border-border bg-background/40 p-3">
            <p className="mb-2 text-sm font-medium">{rf.label}</p>
            <div className="grid grid-cols-3 gap-2">
              {(["yes", "no", "unsure"] as RedFlagAnswer[]).map((a) => {
                const active = value[rf.key] === a;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => set(rf.key, a)}
                    className="rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors"
                    style={
                      active
                        ? a === "yes"
                          ? { background: "#C0392B", color: "#fff", borderColor: "#C0392B" }
                          : { background: brand, color: "#fff", borderColor: brand }
                        : { background: "#fff", borderColor: "var(--border)" }
                    }
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step5Form({
  value,
  onChange,
}: {
  value: { data: boolean; whatsapp: boolean; marketing: boolean };
  onChange: (v: { data: boolean; whatsapp: boolean; marketing: boolean }) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold">Consent</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One required, two optional. You can change these any time.
        </p>
      </div>
      <ConsentRow
        title="Data processing (required)"
        description="I agree my information can be processed to provide my care."
        checked={value.data}
        onChange={(v) => onChange({ ...value, data: v })}
        required
      />
      <ConsentRow
        title="WhatsApp reminders (optional)"
        description="Send me appointment reminders and follow-ups by WhatsApp."
        checked={value.whatsapp}
        onChange={(v) => onChange({ ...value, whatsapp: v })}
      />
      <ConsentRow
        title="Marketing (optional)"
        description="Send me occasional clinic news and offers."
        checked={value.marketing}
        onChange={(v) => onChange({ ...value, marketing: v })}
      />
      <p className="text-xs text-muted-foreground">
        Read our{" "}
        <a href="/privacy" className="underline hover:text-primary">
          privacy notice
        </a>
        .
      </p>
    </div>
  );
}

function ConsentRow({
  title,
  description,
  checked,
  onChange,
  required,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/40 p-3">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
        required={required}
      />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}

function ConfirmedScreen({
  clinic,
  brand,
  slotIso,
  bookingId,
}: {
  clinic: Clinic;
  brand: string;
  slotIso: string | null;
  bookingId: string | null;
}) {
  const slot = slotIso ? new Date(slotIso) : null;
  return (
    <div className="mx-auto mt-6 max-w-2xl px-4">
      <Card className="text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: `${brand}22`, color: brand }}
        >
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">Booking confirmed</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Thanks for booking with{" "}
          <span className="font-medium text-foreground">{clinic.name ?? "our clinic"}</span>.
        </p>
        {slot && (
          <p className="mt-4 rounded-lg bg-background px-4 py-3 text-sm">
            <span className="font-display text-lg font-semibold">
              {slot.toLocaleDateString([], {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
            <br />
            at{" "}
            <span className="font-medium">
              {slot.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          You'll receive a WhatsApp confirmation shortly.
        </p>
        {bookingId && (
          <p className="mt-2 text-xs text-muted-foreground">Reference: {bookingId.slice(0, 8)}</p>
        )}
      </Card>
    </div>
  );
}
