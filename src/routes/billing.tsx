import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Check, X, AlertTriangle, ShieldCheck, MessageCircle, Users, Calendar } from 'lucide-react'

export const Route = createFileRoute('/billing')({
  component: BillingPage,
})

// ─── Types ─────────────────────────────────────────────────────────────────

type ClinicData = {
  subscription_plan: string | null
  trial_ends_at: string | null
  whatsapp_journeys_used: number | null
  whatsapp_journeys_limit: number | null
  max_practitioners: number | null
}

// ─── Plan table config ──────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'solo',
    name: 'Solo',
    price: '£49',
    practitioners: '1',
    journeys: '300',
    aiSoap: false,
    aiFeatures: false,
    multiLocation: false,
    priority: false,
  },
  {
    id: 'team',
    name: 'Team',
    price: '£99',
    practitioners: '2–3',
    journeys: '1,000',
    aiSoap: true,
    aiFeatures: false,
    multiLocation: false,
    priority: false,
  },
  {
    id: 'group',
    name: 'Group',
    price: '£199',
    practitioners: 'Unlimited',
    journeys: '3,000',
    aiSoap: true,
    aiFeatures: true,
    multiLocation: true,
    priority: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    practitioners: 'Unlimited',
    journeys: 'Unlimited',
    aiSoap: true,
    aiFeatures: true,
    multiLocation: true,
    priority: true,
  },
]

const PLAN_PRICES: Record<string, string> = {
  solo: '£49', team: '£99', group: '£199', enterprise: 'Custom', trial: 'Free',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysRemaining(trialEndsAt: string): number {
  const end = new Date(trialEndsAt).getTime()
  const now = Date.now()
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))
}

function ProgressBar({ value, max, warn = false }: { value: number; max: number; warn?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const isAmber = warn && pct >= 80
  return (
    <div className="w-full h-2 bg-border rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${isAmber ? 'bg-amber-400' : 'bg-primary'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function Tick({ yes }: { yes: boolean }) {
  return yes
    ? <Check className="w-4 h-4 text-primary mx-auto" />
    : <X className="w-4 h-4 text-text/25 mx-auto" />
}

// ─── Page ────────────────────────────────────────────────────────────────────

function BillingPage() {
  const [clinic, setClinic] = useState<ClinicData | null>(null)
  const [sessionsThisMonth, setSessionsThisMonth] = useState(0)
  const [practitionerCount, setPractitionerCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: cu } = await supabase
        .from('clinic_users').select('clinic_id').eq('auth_user_id', user.id).single()
      if (!cu) return
      const cid = cu.clinic_id

      // Clinic plan + usage fields
      const { data: clinicData } = await supabase
        .from('clinics')
        .select('subscription_plan, trial_ends_at, whatsapp_journeys_used, whatsapp_journeys_limit, max_practitioners')
        .eq('id', cid)
        .single()
      if (clinicData) setClinic(clinicData)

      // Sessions this month
      const firstOfMonth = new Date()
      firstOfMonth.setDate(1); firstOfMonth.setHours(0, 0, 0, 0)
      const { count: sessCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', cid)
        .gte('appointment_time', firstOfMonth.toISOString())
      setSessionsThisMonth(sessCount ?? 0)

      // Practitioners
      const { count: practCount } = await supabase
        .from('clinic_users')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', cid)
      setPractitionerCount(practCount ?? 0)
    } catch (e) {
      console.error('[Billing] fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = () => {
    toast.info("Stripe payments coming soon — we'll notify you when billing is live.", { duration: 5000 })
  }

  const plan = clinic?.subscription_plan ?? 'trial'
  const isTrial = plan === 'trial'
  const days = clinic?.trial_ends_at ? daysRemaining(clinic.trial_ends_at) : 0
  const trialDaysUsed = 14 - days
  const journeysUsed = clinic?.whatsapp_journeys_used ?? 0
  const journeysLimit = clinic?.whatsapp_journeys_limit ?? 300
  const maxPract = clinic?.max_practitioners ?? 1

  const card = 'bg-card border border-border rounded-xl p-6 shadow-sm'

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-[28px] font-bold text-primary font-bricolage">Billing</h1>

        {/* ══════════════════════════════════════════
            SECTION 1 — Current Plan Card
        ══════════════════════════════════════════ */}
        <div className={card}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-bold text-text font-bricolage text-lg">Current Plan</h2>
                {isTrial ? (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                    Free Trial
                  </span>
                ) : (
                  <>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 capitalize">
                      {plan}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                      Active
                    </span>
                  </>
                )}
              </div>
              <p className="text-sm text-text/60">
                {isTrial ? 'Your 14-day trial' : `${PLAN_PRICES[plan] ?? '—'} / month`}
              </p>
            </div>
            <button
              onClick={handleUpgrade}
              className="bg-primary hover:opacity-90 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              {isTrial ? 'Upgrade Now' : 'Change Plan'}
            </button>
          </div>

          {/* Trial countdown */}
          {isTrial && clinic?.trial_ends_at && (
            <div className={`rounded-xl p-4 mb-5 border ${days <= 3 ? 'bg-alert/5 border-alert/20' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {days <= 3 && <AlertTriangle className="w-4 h-4 text-alert" />}
                <span className={`text-sm font-semibold ${days <= 3 ? 'text-alert' : 'text-amber-700'}`}>
                  {days === 0 ? 'Trial expired' : `${days} day${days === 1 ? '' : 's'} remaining`}
                </span>
              </div>
              <ProgressBar value={trialDaysUsed} max={14} />
              <div className="flex justify-between text-xs text-text/40 mt-1">
                <span>Day 1</span>
                <span>Day 14</span>
              </div>
              {days <= 3 && days > 0 && (
                <p className="text-xs text-alert mt-2 font-medium">
                  ⚠ Upgrade to keep your data and avoid disruption.
                </p>
              )}
            </div>
          )}

          {/* WhatsApp journeys usage */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-text flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-primary" />
                WhatsApp Journeys
              </span>
              <span className="text-text/60 font-mono">
                {journeysUsed} / {journeysLimit === -1 ? '∞' : journeysLimit} used
              </span>
            </div>
            <ProgressBar value={journeysUsed} max={journeysLimit === -1 ? 1 : journeysLimit} warn />
            {journeysLimit > 0 && journeysUsed / journeysLimit >= 0.8 && (
              <p className="text-xs text-amber-600 font-medium">
                You're using over 80% of your WhatsApp journey allowance.
              </p>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════
            SECTION 2 — Usage Stats
        ══════════════════════════════════════════ */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* WhatsApp journeys */}
            <div className={card}>
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-text">WhatsApp Journeys</span>
              </div>
              <p className="text-3xl font-bold font-bricolage text-primary mb-1">{journeysUsed}</p>
              <p className="text-xs text-text/50 mb-3">of {journeysLimit === -1 ? 'unlimited' : journeysLimit} this period</p>
              <ProgressBar value={journeysUsed} max={journeysLimit === -1 ? 1 : journeysLimit} warn />
            </div>

            {/* Practitioners */}
            <div className={card}>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-text">Practitioners</span>
              </div>
              <p className="text-3xl font-bold font-bricolage text-primary mb-1">{practitionerCount}</p>
              <p className="text-xs text-text/50 mb-3">
                of {maxPract === -1 ? 'unlimited' : maxPract} on your plan
              </p>
              <ProgressBar value={practitionerCount} max={maxPract === -1 ? practitionerCount : maxPract} />
            </div>

            {/* Sessions this month */}
            <div className={card}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-text">Sessions This Month</span>
              </div>
              <p className="text-3xl font-bold font-bricolage text-primary mb-1">{sessionsThisMonth}</p>
              <p className="text-xs text-text/50">
                {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            SECTION 3 — Plan Comparison Table
        ══════════════════════════════════════════ */}
        <div className={card}>
          <h2 className="font-bold text-text font-bricolage text-lg mb-5">Plan Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-3 text-text/50 font-medium w-40">Feature</th>
                  {PLANS.map(p => (
                    <th key={p.id} className={`p-3 text-center ${plan === p.id ? 'border-x-2 border-t-2 border-primary rounded-t-lg bg-primary/5' : ''}`}>
                      <div className="font-bold text-text font-bricolage">{p.name}</div>
                      <div className={`text-xs font-normal mt-0.5 ${plan === p.id ? 'text-primary font-semibold' : 'text-text/50'}`}>
                        {p.price}{p.id !== 'enterprise' ? '/mo' : ''}
                      </div>
                      {plan === p.id && (
                        <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-white">Current</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { label: 'Price/month', values: PLANS.map(p => p.price) },
                  { label: 'Practitioners', values: PLANS.map(p => p.practitioners) },
                  { label: 'WhatsApp journeys', values: PLANS.map(p => p.journeys) },
                  { label: 'AI SOAP Notes', values: PLANS.map(p => p.aiSoap), bool: true },
                  { label: 'AI Features', values: PLANS.map(p => p.aiFeatures), bool: true },
                  { label: 'Multi-location', values: PLANS.map(p => p.multiLocation), bool: true },
                  { label: 'Priority support', values: PLANS.map(p => p.priority), bool: true },
                ].map(row => (
                  <tr key={row.label} className="hover:bg-background/40 transition-colors">
                    <td className="p-3 font-medium text-text/70">{row.label}</td>
                    {PLANS.map((p, i) => (
                      <td
                        key={p.id}
                        className={`p-3 text-center ${plan === p.id ? 'border-x-2 border-primary bg-primary/5' : ''}`}
                      >
                        {row.bool
                          ? <Tick yes={row.values[i] as boolean} />
                          : <span className={`font-medium ${plan === p.id ? 'text-primary' : 'text-text/80'}`}>{row.values[i] as string}</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Upgrade buttons row */}
                <tr>
                  <td className="p-3" />
                  {PLANS.map(p => (
                    <td
                      key={p.id}
                      className={`p-3 text-center ${plan === p.id ? 'border-x-2 border-b-2 border-primary rounded-b-lg bg-primary/5' : ''}`}
                    >
                      {plan === p.id ? (
                        <span className="text-xs text-primary font-semibold">Current Plan</span>
                      ) : (
                        <button
                          onClick={handleUpgrade}
                          className="w-full bg-primary hover:opacity-90 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
                        >
                          {p.id === 'enterprise' ? 'Contact Us' : 'Upgrade'}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            SECTION 4 — Trial Protection Info
        ══════════════════════════════════════════ */}
        <div className="bg-background border border-border rounded-xl p-5 flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text mb-1">Trial Account Protection</p>
            <p className="text-sm text-text/60 leading-relaxed">
              KinetiMap uses WhatsApp verification to protect trial accounts.
              Each phone number can only start one free trial.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
