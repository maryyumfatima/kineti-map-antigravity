import { createFileRoute, useParams } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Check, Minus, AlertTriangle, ShieldCheck, MessageCircle, Users, Calendar, X, ChevronDown, Sparkles } from 'lucide-react'

export const Route = createFileRoute('/$country/billing')({
  component: BillingPage,
})

// ─── Types ─────────────────────────────────────────────────────────────────

type ClinicData = {
  subscription_plan: string | null
  trial_ends_at: string | null
  whatsapp_journeys_used: number | null
  whatsapp_journeys_limit: number | null
  ai_credits_used: number | null
  max_practitioners: number | null
}

// ─── Currency / region detection ────────────────────────────────────────────

type Currency = 'GBP' | 'PKR' | 'AUD'

type RegionInfo = {
  currency: Currency
  countryCode: string
  label: string
  flag: string
}

const REGIONS: Record<string, RegionInfo> = {
  gb: { currency: 'GBP', countryCode: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  pk: { currency: 'PKR', countryCode: 'PK', label: 'Pakistan',       flag: '🇵🇰' },
  au: { currency: 'AUD', countryCode: 'AU', label: 'Australia',      flag: '🇦🇺' },
}

function getRegionFromParam(country: string): RegionInfo {
  return REGIONS[country?.toLowerCase()] || REGIONS.gb
}

// ─── Plan table config ──────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'essentials',
    name: 'Essentials',
    price: { GBP: '£49', PKR: 'PKR 5,000', AUD: 'A$79' },
    practitioners: '1',
    journeys: '300',
    aiSoap: '200 / mo',
    aiPainTrend: 'Included',
    description: 'Solo physio, 8-10 patients/day',
    aiFollowUp: false,
    aiDischarge: false,
    multiLocation: false,
    priority: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: { GBP: '£89', PKR: 'PKR 9,000', AUD: 'A$139' },
    practitioners: '2–3',
    journeys: '1,000',
    aiSoap: '600 / mo',
    aiPainTrend: 'Included',
    description: '2-3 practitioners, comfortable',
    aiFollowUp: true,
    aiDischarge: true,
    multiLocation: false,
    priority: false,
  },
  {
    id: 'scale',
    name: 'Scale',
    price: { GBP: '£179', PKR: 'PKR 16,000', AUD: 'A$279' },
    practitioners: 'Unlimited',
    journeys: '3,000',
    aiSoap: '1,500 / mo',
    aiPainTrend: 'Included',
    description: 'Large clinic, multi-location',
    aiFollowUp: true,
    aiDischarge: true,
    multiLocation: true,
    priority: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: { GBP: 'Custom', PKR: 'Custom', AUD: 'Custom' },
    practitioners: 'Unlimited',
    journeys: 'Unlimited',
    aiSoap: 'Custom',
    aiPainTrend: 'Unlimited',
    description: 'Negotiate per contract',
    aiFollowUp: true,
    aiDischarge: true,
    multiLocation: true,
    priority: true,
  },
]

const AI_PACKS = [
  { id: 'small',  label: 'Small Pack',  credits: 100, price: { GBP: '£8',  PKR: '700',   AUD: '15' } },
  { id: 'medium', label: 'Medium Pack', credits: 300, price: { GBP: '£18', PKR: '1,500', AUD: '32' } },
  { id: 'large',  label: 'Large Pack',  credits: 500, price: { GBP: '£25', PKR: '2,200', AUD: '45' } },
]

const PLAN_PRICES: Record<string, Record<Currency, string>> = {
  essentials: { GBP: '£49/mo', PKR: 'PKR 5,000/mo', AUD: 'A$79/mo' },
  growth:     { GBP: '£89/mo', PKR: 'PKR 9,000/mo', AUD: 'A$139/mo' },
  scale:      { GBP: '£179/mo', PKR: 'PKR 16,000/mo', AUD: 'A$279/mo' },
  enterprise: { GBP: 'Custom', PKR: 'Custom', AUD: 'Custom' },
  trial:      { GBP: 'Free Trial', PKR: 'Free Trial', AUD: 'Free Trial' },
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

function FeatureTick({ yes }: { yes: boolean }) {
  return yes
    ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 mx-auto"><Check className="w-3 h-3 text-primary" strokeWidth={3} /></span>
    : <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-border mx-auto"><Minus className="w-3 h-3 text-text/30" strokeWidth={2.5} /></span>
}

// ─── Page ────────────────────────────────────────────────────────────────────

function BillingPage() {
  const { country } = useParams({ strict: false }) as { country: string }
  const [clinic, setClinic] = useState<ClinicData | null>(null)
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [sessionsThisMonth, setSessionsThisMonth] = useState(0)
  const [practitionerCount, setPractitionerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showTestModal, setShowTestModal] = useState(false)
  
  const region = getRegionFromParam(country)

  const isTestMode = (import.meta as any).env.VITE_TEST_MODE === 'true'

  useEffect(() => {
    fetchData(region)
  }, [country])

  const fetchData = async (detectedRegion?: RegionInfo) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: cu } = await supabase
        .from('clinic_users').select('clinic_id').eq('auth_user_id', user.id).single()
      if (!cu) return
      const cid = cu.clinic_id
      setClinicId(cid)

      const { data: clinicData } = await supabase
        .from('clinics')
        .select('subscription_plan, trial_ends_at, whatsapp_journeys_used, whatsapp_journeys_limit, max_practitioners, ai_credits_used')
        .eq('id', cid)
        .single()
      if (clinicData) setClinic(clinicData)

      // Persist detected region to Supabase (soft — ignore errors if cols don't exist yet)
      if (detectedRegion) {
        supabase.from('clinics').update({
          country_code: detectedRegion.countryCode,
          currency: detectedRegion.currency,
        }).eq('id', cid).then(({ error }) => {
          if (error) console.warn('[Billing] country_code/currency columns not yet in DB:', error.message)
        })
      }

      const firstOfMonth = new Date()
      firstOfMonth.setDate(1); firstOfMonth.setHours(0, 0, 0, 0)
      const { count: sessCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', cid)
        .gte('appointment_time', firstOfMonth.toISOString())
      setSessionsThisMonth(sessCount ?? 0)

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
    if (isTestMode) {
      setShowTestModal(true)
    } else {
      toast.info("Stripe payments coming soon — we'll notify you when billing is live.", { duration: 5000 })
    }
  }

  const handleTestUpgrade = async (planId: string) => {
    if (!clinicId) return
    try {
      const { error } = await supabase.from('clinics').update({ subscription_plan: planId }).eq('id', clinicId)
      if (error) throw error
      toast.success(`Test Mode: Plan updated to ${planId}`)
      setShowTestModal(false)
      fetchData()
    } catch (e) {
      toast.error('Failed to update plan')
    }
  }



  const plan = clinic?.subscription_plan ?? 'trial'
  const isTrial = plan === 'trial'
  const days = clinic?.trial_ends_at ? daysRemaining(clinic.trial_ends_at) : 0
  const trialDaysUsed = 14 - days
  const journeysUsed = clinic?.whatsapp_journeys_used ?? 0
  const journeysLimit = isTrial ? 20 : (clinic?.whatsapp_journeys_limit ?? 300)
  const aiCreditsUsed = clinic?.ai_credits_used ?? 0
  const aiCreditsLimit = isTrial ? 5 : (plan === 'essentials' ? 200 : plan === 'growth' ? 600 : plan === 'scale' ? 1500 : 999999)
  const maxPract = clinic?.max_practitioners ?? 1
  const currency = region.currency

  const card = 'bg-card border border-border rounded-xl p-6 card-shadow transition-premium'

  // Feature rows for comparison table
  const featureRows = [
    { label: 'Price / month', values: PLANS.map(p => p.price[currency]) },
    { label: 'Practitioners', values: PLANS.map(p => p.practitioners) },
    { label: 'WhatsApp Journeys', values: PLANS.map(p => p.journeys) },
    { label: 'AI SOAP Notes', values: PLANS.map(p => p.aiSoap) },
    { label: 'AI Pain Trend Summary', values: PLANS.map(p => p.aiPainTrend) },
    { label: 'AI Follow-up Suggestions', values: PLANS.map(p => p.aiFollowUp), bool: true },
    { label: 'AI Discharge Letter', values: PLANS.map(p => p.aiDischarge), bool: true },
    { label: 'Multi-location', values: PLANS.map(p => p.multiLocation), bool: true },
    { label: 'Priority Support', values: PLANS.map(p => p.priority), bool: true },
  ]

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-[28px] font-bold text-primary font-bricolage">Billing</h1>

        {/* ══ SECTION 1 — Current Plan Card ══ */}
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
                {isTrial ? 'Your 14-day trial' : (PLAN_PRICES[plan]?.[currency] ?? '—')}
              </p>
              <div className="mt-2">
                <div className="inline-flex items-center gap-1.5 text-xs text-text/50">
                  <span>{region.flag} Prices shown in {region.currency}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isTestMode && (
                <span className="text-xs font-bold px-2.5 py-1 bg-orange-500 text-white shadow-sm rounded-md flex items-center gap-1.5 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Test Mode
                </span>
              )}
              <button
                onClick={() => handleUpgrade()}
                className="btn-premium bg-primary text-white text-sm font-semibold px-6 py-2.5 rounded-lg shadow-lg shadow-primary/20 hover:opacity-90"
              >
                {isTrial ? 'Upgrade Now' : 'Change Plan'}
              </button>
            </div>
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

        {/* ══ SECTION 2 — Usage Stats ══ */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={card}>
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-text">WhatsApp Journeys</span>
              </div>
              <p className="text-3xl font-bold font-bricolage text-primary mb-1">{journeysUsed}</p>
              <p className="text-xs text-text/50 mb-3">of {journeysLimit === -1 ? 'unlimited' : journeysLimit} this period</p>
              <ProgressBar value={journeysUsed} max={journeysLimit === -1 ? 1 : journeysLimit} warn />
            </div>

            <div className={card}>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-text">AI Credits</span>
              </div>
              <p className="text-3xl font-bold font-bricolage text-primary mb-1">{aiCreditsUsed}</p>
              <p className="text-xs text-text/50 mb-3">of {aiCreditsLimit >= 999999 ? 'unlimited' : aiCreditsLimit} this period</p>
              <ProgressBar value={aiCreditsUsed} max={aiCreditsLimit === 0 ? 1 : aiCreditsLimit} warn />
            </div>

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
          </div>
        )}

        {/* ══ SECTION 2.5 — AI Credit Packs ══ */}
        <div className={card}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-text font-bricolage">Add-Ons Agar Zyada Chahiye</h2>
              <p className="text-sm text-text/50 mt-1">Boost your AI credits instantly when you need a little more magic.</p>
            </div>
            <Sparkles className="w-8 h-8 text-primary opacity-20" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {AI_PACKS.map(pack => (
              <div key={pack.id} className="border border-border rounded-xl p-5 hover:border-primary/30 transition-all group">
                <div className="text-xs font-bold text-primary/60 uppercase tracking-wider mb-1">{pack.label}</div>
                <div className="text-2xl font-bold text-text mb-4">+{pack.credits} Credits</div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-text/80">{pack.price[currency]} {currency}</span>
                  <button className="bg-background hover:bg-primary hover:text-white border border-border group-hover:border-primary text-text px-4 py-1.5 rounded-lg text-sm font-bold transition-all">
                    Add Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ SECTION 3 — Plan Comparison Table ══ */}
        <div className={card}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <h2 className="font-bold text-text font-bricolage text-lg">Plan Comparison</h2>
            {/* Detected region label — no tab switcher (handled via Change region above) */}
            <span className="text-xs text-text/50 bg-background border border-border rounded-lg px-3 py-1.5">
              {region.flag} Prices in {region.currency}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-3 text-text/50 font-medium w-44">Feature</th>
                  {PLANS.map(p => (
                    <th key={p.id} className={`p-3 text-center ${plan === p.id ? 'border-x-2 border-t-2 border-primary rounded-t-lg bg-primary/5' : ''}`}>
                      <div className="font-bold text-text font-bricolage">{p.name}</div>
                      <div className={`text-xs font-normal mt-0.5 ${plan === p.id ? 'text-primary font-semibold' : 'text-text/50'}`}>
                        {p.price[currency]}{p.id !== 'enterprise' ? '/mo' : ''}
                      </div>
                      {plan === p.id && (
                        <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-white">Current</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {featureRows.map(row => (
                  <tr key={row.label} className="hover:bg-background/40 transition-colors">
                    <td className="p-3 font-medium text-text/70 leading-tight">{row.label}</td>
                    {PLANS.map((p, i) => (
                      <td
                        key={p.id}
                        className={`p-3 text-center ${plan === p.id ? 'border-x-2 border-primary bg-primary/5' : ''}`}
                      >
                        {row.bool
                          ? <FeatureTick yes={row.values[i] as boolean} />
                          : <span className={`font-medium text-xs ${plan === p.id ? 'text-primary' : 'text-text/80'}`}>{row.values[i] as string}</span>
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

        {/* ══ SECTION 4 — Trial Protection Info ══ */}
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

      {/* ══ Test Mode Modal ══ */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg font-bricolage text-text">Test Mode: Select a plan</h3>
                <p className="text-xs text-text/50 mt-0.5">No payment required — for testing only</p>
              </div>
              <button onClick={() => setShowTestModal(false)} className="text-text/50 hover:text-text p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-3">
              {[
                { id: 'essentials', label: 'Essentials', sub: `${PLAN_PRICES.essentials[currency]}` },
                { id: 'growth', label: 'Growth', sub: `${PLAN_PRICES.growth[currency]}` },
                { id: 'scale', label: 'Scale', sub: `${PLAN_PRICES.scale[currency]}` },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => handleTestUpgrade(p.id)}
                  className="w-full flex items-center justify-between bg-background hover:bg-primary/5 border border-border hover:border-primary text-text font-semibold py-3 px-4 rounded-lg transition-all"
                >
                  <span>{p.label}</span>
                  <span className="text-sm font-normal text-text/50">{p.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
