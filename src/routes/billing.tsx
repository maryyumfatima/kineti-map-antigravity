import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Check, Minus, AlertTriangle, ShieldCheck, MessageCircle, Users, X, Sparkles, Loader2, Plus, ChevronDown } from 'lucide-react'

export const Route = createFileRoute('/billing')({
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

type Currency = 'GBP'

type RegionInfo = {
  currency: Currency
  countryCode: string
  label: string
  flag: string
}

const REGIONS: Record<string, RegionInfo> = {
  gb: { currency: 'GBP', countryCode: 'GB', label: 'United Kingdom', flag: '🇬🇧' }
}

function getRegionInfo(): RegionInfo {
  return REGIONS.gb
}

// ─── Plan table config ──────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'essentials',
    name: 'Essentials',
    basePrice: 49,
    practitioners: '1',
    journeys: '500',
    aiSoap: '200 / mo',
    summary: 'Daily & Monthly',
    migration: 'Self-service CSV data migration (free)',
    support: 'Standard',
    multiLocation: false,
    trial: '14-day free trial',
    features: [
      '1 Practitioner',
      '500 WhatsApp Journeys/month',
      '200 AI SOAP Credits/month',
      'Daily & Monthly Summary',
      'Self-service CSV data migration (free)',
      '14-day free trial',
      'Standard support',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    basePrice: 89,
    practitioners: '3',
    journeys: '1500',
    aiSoap: '800 / mo',
    summary: 'Daily & Monthly',
    migration: 'Guided data migration included',
    support: 'Priority',
    multiLocation: false,
    trial: '14-day free trial',
    features: [
      '3 Practitioners',
      '1500 WhatsApp Journeys/month',
      '800 AI SOAP Credits/month',
      'Daily & Monthly Summary',
      'Guided data migration included',
      '14-day free trial',
      'Priority support',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    basePrice: 179,
    practitioners: '8',
    journeys: '4000',
    aiSoap: '2000 / mo',
    summary: 'Daily & Monthly',
    migration: 'Full concierge data migration included',
    support: 'Priority',
    multiLocation: true,
    trial: '14-day free trial',
    features: [
      '8 Practitioners',
      '4000 WhatsApp Journeys/month',
      '2000 AI SOAP Credits/month',
      'Daily & Monthly Summary',
      'Multi-location support',
      'Full concierge data migration included',
      '14-day free trial',
      'Priority support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    basePrice: 0,
    practitioners: 'Unlimited',
    journeys: 'Custom',
    aiSoap: 'Custom',
    summary: 'Scale features',
    migration: 'Full concierge data migration included',
    support: 'Dedicated',
    multiLocation: true,
    trial: '14-day free trial',
    features: [
      'Unlimited Practitioners',
      'Custom WhatsApp Journeys',
      'Custom AI SOAP Credits',
      'Everything in Scale',
      'Dedicated support',
      'Contact us button'
    ]
  }
]

const AI_PACKS = [
  { id: 'small', label: 'Small Pack', credits: 100, price: '£8' },
  { id: 'medium', label: 'Medium Pack', credits: 300, price: '£18' },
  { id: 'large', label: 'Large Pack', credits: 500, price: '£25' },
]

const PLAN_PRICES: Record<string, string> = {
  essentials: '£49/mo',
  growth: '£89/mo',
  scale: '£179/mo',
  enterprise: 'Custom',
  trial: 'Free Trial',
}

const getPlanPrice = (basePrice: number, period: string) => {
  if (basePrice === 0) return { monthlyEquiv: 'Custom', totalBill: 'Custom', detail: '' }
  let discount = 0
  let months = 1
  let detail = 'billed monthly'
  if (period === '3month') {
    discount = 0.10
    months = 3
    detail = 'billed £' + (basePrice * (1 - discount) * months).toFixed(2).replace('.00', '') + ' quarterly'
  } else if (period === '6month') {
    discount = 0.16
    months = 6
    detail = 'billed £' + (basePrice * (1 - discount) * months).toFixed(2).replace('.00', '') + ' semi-annually'
  } else if (period === 'yearly') {
    discount = 0.25
    months = 12
    detail = 'billed £' + (basePrice * (1 - discount) * months).toFixed(2).replace('.00', '') + ' annually'
  }
  const monthlyEquiv = basePrice * (1 - discount)
  return {
    monthlyEquiv: `£${monthlyEquiv.toFixed(2).replace('.00', '')}`,
    totalBill: `£${(monthlyEquiv * months).toFixed(2).replace('.00', '')}`,
    detail,
  }
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
  const [clinic, setClinic] = useState<ClinicData | null>(null)
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [practitionerCount, setPractitionerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string>('essentials')
  const [selectedPriceLabel, setSelectedPriceLabel] = useState<string>('£49')
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | '3month' | '6month' | 'yearly'>('monthly')

  const region = getRegionInfo()

  const isTestMode = (import.meta as any).env.VITE_TEST_MODE === 'true'

  useEffect(() => {
    fetchData(region)
  }, [])

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

  const handleUpgrade = (planId?: string) => {
    const targetPlanId = planId || 'essentials'
    if (targetPlanId === 'enterprise') {
      window.location.href = "mailto:support@kinetimap.app?subject=KinetiMap Enterprise Pricing Inquiry"
      return
    }
    const planConfig = PLANS.find(p => p.id === targetPlanId)
    const priceInfo = getPlanPrice(planConfig ? planConfig.basePrice : 49, billingPeriod)
    const priceLabel = priceInfo.monthlyEquiv

    setSelectedPlanId(targetPlanId)
    setSelectedPriceLabel(priceLabel)

    if (isTestMode) {
      setIsCheckoutOpen(true)
    } else {
      toast.info("Stripe payments coming soon — we'll notify you when billing is live.", { duration: 5000 })
    }
  }



  const plan = clinic?.subscription_plan ?? 'trial'
  const isTrial = plan === 'trial'
  const days = clinic?.trial_ends_at ? daysRemaining(clinic.trial_ends_at) : 0
  const trialDaysUsed = 14 - days
  const journeysUsed = clinic?.whatsapp_journeys_used ?? 0
  const journeysLimit = isTrial ? 20 : (clinic?.whatsapp_journeys_limit ?? 500)
  const aiCreditsUsed = clinic?.ai_credits_used ?? 0
  const aiCreditsLimit = isTrial ? 5 : (plan === 'essentials' ? 200 : plan === 'growth' ? 800 : plan === 'scale' ? 2000 : 999999)
  const maxPract = clinic?.max_practitioners ?? 1


  const card = 'bg-card border border-border rounded-xl p-6 card-shadow transition-premium'

  // Feature rows for comparison table
  const featureRows = [
    { label: 'Price / month', values: PLANS.map(p => getPlanPrice(p.basePrice, billingPeriod).monthlyEquiv) },
    { label: 'Practitioners', values: PLANS.map(p => p.practitioners) },
    { label: 'WhatsApp Journeys', values: PLANS.map(p => p.journeys) },
    { label: 'AI SOAP Notes', values: PLANS.map(p => p.aiSoap) },
    { label: 'Daily & Monthly Summary', values: PLANS.map(p => p.summary) },
    { label: 'Data Migration', values: PLANS.map(p => p.migration) },
    { label: 'Multi-location', values: PLANS.map(p => p.multiLocation), bool: true },
    { label: 'Support', values: PLANS.map(p => p.support) },
    { label: 'Free Trial', values: PLANS.map(p => p.trial) },
  ]

  return (
    <DashboardLayout>
      <Helmet>
        <title>Billing | KinetiMap</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
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
                {isTrial ? 'Your 14-day trial' : (PLAN_PRICES[plan] ?? '—')}
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
              <ProgressBar value={aiCreditsUsed} max={aiCreditsLimit} warn />
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
              <h2 className="text-xl font-bold text-text font-bricolage">Add-Ons</h2>
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
                  <span className="text-lg font-bold text-text/80">{pack.price}</span>
                  <button className="bg-background hover:bg-primary hover:text-white border border-border group-hover:border-primary text-text px-4 py-1.5 rounded-lg text-sm font-bold transition-all">
                    Add Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ SECTION 2.7 — Dynamic Pricing Cards Grid & Billing Switcher ══ */}
        <div className="space-y-6 pt-4">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl font-bold font-bricolage text-text">Choose the right plan for your clinic</h2>
            <p className="text-sm text-text/60">
              14-day free trial on all plans. No credit card required.
            </p>
          </div>

          <div className="flex justify-center">
            <div className="bg-white border border-border p-1 rounded-full flex shadow-sm">
              {[
                { id: 'monthly', label: 'Monthly' },
                { id: '3month', label: '3 Months (10% off)' },
                { id: '6month', label: '6 Months (16% off)' },
                { id: 'yearly', label: 'Yearly (25% off)' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setBillingPeriod(p.id as any)}
                  type="button"
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${billingPeriod === p.id ? 'bg-primary text-white shadow-md' : 'text-text/60 hover:text-text'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLANS.map(p => {
              const isCurrent = plan === p.id
              const priceInfo = getPlanPrice(p.basePrice, billingPeriod)
              
              return (
                <div 
                  key={p.id} 
                  className={`bg-card border rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-all hover:translate-y-[-4px] hover:shadow-md ${isCurrent ? 'border-primary ring-1 ring-primary/20 bg-primary/[0.01]' : 'border-border'}`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-lg font-bricolage text-text">{p.name}</h3>
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary text-white">Current Plan</span>
                      )}
                    </div>
                    
                    <div className="mb-6">
                      <span className="text-3xl font-bold font-bricolage text-text">
                        {priceInfo.monthlyEquiv}
                      </span>
                      {p.basePrice > 0 && (
                        <span className="text-xs text-text/50 ml-1">/ month</span>
                      )}
                      {priceInfo.detail && (
                        <p className="text-[11px] text-text/40 mt-1">{priceInfo.detail}</p>
                      )}
                    </div>
                    
                    <ul className="space-y-2.5 mb-8">
                      {p.features.map((f, i) => (
                        <li key={i} className="text-xs text-text/70 flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    {isCurrent ? (
                      <button 
                        disabled
                        className="w-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold py-2.5 rounded-xl cursor-default"
                      >
                        Current Plan
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(p.id)}
                        className={`w-full text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer ${p.id === 'enterprise' ? 'bg-background hover:bg-border border border-border text-text' : 'bg-primary hover:opacity-90 text-white shadow-md shadow-primary/10'}`}
                      >
                        {p.id === 'enterprise' ? 'Contact Us' : 'Upgrade Plan'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
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
                  {PLANS.map(p => {
                    const priceInfo = getPlanPrice(p.basePrice, billingPeriod)
                    return (
                      <th key={p.id} className={`p-3 text-center ${plan === p.id ? 'border-x-2 border-t-2 border-primary rounded-t-lg bg-primary/5' : ''}`}>
                        <div className="font-bold text-text font-bricolage">{p.name}</div>
                        <div className={`text-xs font-normal mt-0.5 ${plan === p.id ? 'text-primary font-semibold' : 'text-text/50'}`}>
                          {priceInfo.monthlyEquiv}{p.id !== 'enterprise' ? '/mo' : ''}
                        </div>
                        {plan === p.id && (
                          <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-white">Current</span>
                        )}
                      </th>
                    )
                  })}
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
                          onClick={() => handleUpgrade(p.id)}
                          className="w-full bg-primary hover:opacity-90 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors cursor-pointer"
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

        {/* ══ FAQ Section ══ */}
        <FAQSection />
      </div>

      {/* ══ Mock Checkout Modal ══ */}
      <MockCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        planId={selectedPlanId}
        priceLabel={selectedPriceLabel}
        clinicId={clinicId}
        onSuccess={() => fetchData(region)}
        billingPeriod={billingPeriod}
      />
    </DashboardLayout>
  )
}

function MockCheckoutModal({
  isOpen,
  onClose,
  planId,
  priceLabel,
  clinicId,
  onSuccess,
  billingPeriod,
}: {
  isOpen: boolean
  onClose: () => void
  planId: string
  priceLabel: string
  clinicId: string | null
  onSuccess: () => void
  billingPeriod: string
}) {
  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvc, setCardCvc] = useState('')
  const [email, setEmail] = useState('')
  const [isPaying, setIsPaying] = useState(false)
  const [paymentStep, setPaymentStep] = useState<'idle' | 'authorizing' | 'activating' | 'success'>('idle')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email)
    })
  }, [])

  const planName = planId.charAt(0).toUpperCase() + planId.slice(1)
  const planConfig = PLANS.find(p => p.id === planId)
  const priceInfo = getPlanPrice(planConfig ? planConfig.basePrice : 0, billingPeriod)
  const frequencyLabel = billingPeriod === 'monthly' ? 'Monthly' : billingPeriod === '3month' ? '3 Months' : billingPeriod === '6month' ? '6 Months' : 'Yearly'

  // Card formatting
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').substring(0, 16)
    const formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ')
    setCardNumber(formatted)
  }

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 4)
    if (val.length >= 3) {
      val = val.substring(0, 2) + '/' + val.substring(2)
    }
    setCardExpiry(val)
  }

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').substring(0, 3)
    setCardCvc(val)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clinicId) return
    if (cardNumber.replace(/\s/g, '').length < 16) {
      toast.error('Please enter a valid 16-digit card number')
      return
    }
    if (cardExpiry.length < 5) {
      toast.error('Please enter a valid expiry date (MM/YY)')
      return
    }
    if (cardCvc.length < 3) {
      toast.error('Please enter a valid CVC')
      return
    }

    setIsPaying(true)
    setPaymentStep('authorizing')

    // Stage 1: Authorizing
    await new Promise(resolve => setTimeout(resolve, 1500))
    setPaymentStep('activating')

    // Stage 2: Activating in DB
    try {
      let maxPract = 1
      let journeysLimit = 500

      if (planId === 'growth') {
        maxPract = 3
        journeysLimit = 1500
      } else if (planId === 'scale') {
        maxPract = 8
        journeysLimit = 4000
      } else if (planId === 'enterprise') {
        maxPract = 999999
        journeysLimit = 999999
      }

      const { error } = await supabase
        .from('clinics')
        .update({
          subscription_plan: planId,
          ai_soap_enabled: true,
          trial_ends_at: null,
          max_practitioners: maxPract,
          whatsapp_journeys_limit: journeysLimit,
        })
        .eq('id', clinicId)

      if (error) throw error

      await new Promise(resolve => setTimeout(resolve, 1000))
      setPaymentStep('success')
      await new Promise(resolve => setTimeout(resolve, 800))

      toast.success(`Welcome to ${planName}! Your clinic features are now active.`)
      onSuccess()
      onClose()
    } catch (e: any) {
      toast.error(`Checkout failed: ${e.message || 'Unknown error'}`)
      setIsPaying(false)
      setPaymentStep('idle')
    }
  }

  if (!isOpen) return null

  // Card theme gradients
  const cardGradient =
    planId === 'growth'
      ? 'from-indigo-600 to-purple-600'
      : planId === 'scale'
      ? 'from-amber-500 to-rose-500'
      : 'from-teal-600 to-cyan-700'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card w-full max-w-4xl border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-200">
        
        {/* Left Column: Plan Summary */}
        <div className="w-full md:w-5/12 bg-background/50 border-r border-border p-6 md:p-8 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-primary/80 bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1 uppercase tracking-wider">
                  Plan Selected
                </span>
                <h3 className="text-2xl font-bold font-bricolage text-text mt-2">{planName} Subscription</h3>
              </div>
              <button 
                onClick={onClose} 
                className="md:hidden text-text/40 hover:text-text p-1.5 hover:bg-background rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 border-y border-border space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text/60">Subscription Frequency</span>
                <span className="font-semibold text-text">{frequencyLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text/60">Amount due today</span>
                <span className="font-semibold text-text">
                  £{priceInfo.totalBill}
                  {billingPeriod !== 'monthly' && (
                    <span className="text-xs font-normal text-text/50 block">({priceInfo.monthlyEquiv}/mo equiv)</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text/60">Tax (0% VAT)</span>
                <span className="font-semibold text-text">£0.00</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-text/40 uppercase tracking-widest">Included Features</h4>
              <ul className="space-y-2">
                {[
                  `Up to ${planId === 'essentials' ? '1 Practitioner' : planId === 'growth' ? '3 Practitioners' : planId === 'scale' ? '8 Practitioners' : 'Unlimited Practitioners'}`,
                  `Up to ${planId === 'essentials' ? '500' : planId === 'growth' ? '1,500' : planId === 'scale' ? '4,000' : 'Custom'} WhatsApp Journeys / mo`,
                  `Up to ${planId === 'essentials' ? '200' : planId === 'growth' ? '800' : planId === 'scale' ? '2,000' : 'Custom'} AI SOAP Credits / mo`,
                  'AI Clinical Insights & Continuity Summary',
                  'Cancel or change tier at any time',
                ].map((feat, idx) => (
                  <li key={idx} className="text-xs text-text/75 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-border hidden md:flex items-center gap-3 text-text/40 text-[11px] leading-snug">
            <ShieldCheck className="w-8 h-8 text-primary shrink-0" />
            <span>
              Mock payments are active. Your payment is secure and runs in sandboxed test mode.
            </span>
          </div>
        </div>

        {/* Right Column: Interactive Payment Form */}
        <div className="w-full md:w-7/12 p-6 md:p-8 flex flex-col justify-between relative bg-card">
          <button 
            onClick={onClose} 
            className="hidden md:flex absolute top-5 right-5 text-text/40 hover:text-text p-1.5 hover:bg-background rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {paymentStep !== 'idle' ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-6 min-h-[350px]">
              {paymentStep === 'authorizing' && (
                <>
                  <div className="relative w-16 h-16">
                    <Loader2 className="w-16 h-16 text-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg font-bricolage text-text">Authorizing Mock Card</h4>
                    <p className="text-sm text-text/50 mt-1">Connecting to virtual secure gateway...</p>
                  </div>
                </>
              )}

              {paymentStep === 'activating' && (
                <>
                  <div className="relative w-16 h-16">
                    <Loader2 className="w-16 h-16 text-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg font-bricolage text-text">Activating {planName} Plan</h4>
                    <p className="text-sm text-text/50 mt-1">Configuring limits and enabling AI modules...</p>
                  </div>
                </>
              )}

              {paymentStep === 'success' && (
                <>
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center border border-green-200 animate-bounce">
                    <Check className="w-8 h-8 text-green-600" strokeWidth={3} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg font-bricolage text-green-700">Payment Successful!</h4>
                    <p className="text-sm text-text/50 mt-1">Direct subscription activated successfully.</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h3 className="font-bold text-lg font-bricolage text-text mb-4">Secure Checkout</h3>
                
                {/* Visual Credit Card */}
                <div className={`w-full aspect-[1.586/1] max-w-[340px] mx-auto rounded-2xl bg-gradient-to-br ${cardGradient} p-5 text-white flex flex-col justify-between shadow-xl relative overflow-hidden mb-6 select-none`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-8 -mt-8 blur-lg" />
                  
                  {/* Top: Chip & Network Logo */}
                  <div className="flex justify-between items-center">
                    <div className="w-10 h-7 rounded bg-amber-300/80 border border-amber-400/40 relative overflow-hidden flex items-center justify-center shadow-inner">
                      {/* Chip lines */}
                      <div className="absolute inset-x-2 border-y border-amber-600/30 h-1/2 top-1/4" />
                      <div className="absolute inset-y-1.5 border-x border-amber-600/30 w-1/2 left-1/4" />
                    </div>
                    <span className="font-bold text-sm italic tracking-widest opacity-85">KINETIMAP</span>
                  </div>

                  {/* Mid: Card Number */}
                  <div className="text-lg md:text-xl font-mono tracking-widest text-center py-2 min-h-[36px]">
                    {cardNumber || '•••• •••• •••• ••••'}
                  </div>

                  {/* Bottom: Holder Name + Expiry */}
                  <div className="flex justify-between items-end">
                    <div className="space-y-0.5 max-w-[70%]">
                      <span className="text-[8px] uppercase tracking-wider opacity-60">Card Holder</span>
                      <div className="text-xs font-semibold tracking-wide truncate uppercase">
                        {cardName || 'YOUR FULL NAME'}
                      </div>
                    </div>
                    <div className="space-y-0.5 text-right shrink-0">
                      <span className="text-[8px] uppercase tracking-wider opacity-60">Expires</span>
                      <div className="text-xs font-mono font-semibold">
                        {cardExpiry || 'MM/YY'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-text/40 uppercase tracking-widest mb-1.5">Billing Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="physio@clinic.com"
                      className="w-full px-3 py-2 border border-border rounded-lg outline-none text-sm bg-background text-text focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-text/40 uppercase tracking-widest mb-1.5">Card Number</label>
                      <input
                        type="text"
                        required
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                        placeholder="4242 4242 4242 4242"
                        className="w-full px-3 py-2 border border-border rounded-lg outline-none text-sm font-mono bg-background text-text focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-text/40 uppercase tracking-widest mb-1.5">Expiry Date</label>
                      <input
                        type="text"
                        required
                        value={cardExpiry}
                        onChange={handleExpiryChange}
                        placeholder="MM/YY"
                        className="w-full px-3 py-2 border border-border rounded-lg outline-none text-sm font-mono bg-background text-text focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-text/40 uppercase tracking-widest mb-1.5">Security Code (CVC)</label>
                      <input
                        type="text"
                        required
                        value={cardCvc}
                        onChange={handleCvcChange}
                        placeholder="123"
                        className="w-full px-3 py-2 border border-border rounded-lg outline-none text-sm font-mono bg-background text-text focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text/40 uppercase tracking-widest mb-1.5">Cardholder Name</label>
                    <input
                      type="text"
                      required
                      value={cardName}
                      onChange={e => setCardName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full px-3 py-2 border border-border rounded-lg outline-none text-sm bg-background text-text focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase font-medium"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPaying}
                className="w-full btn-premium bg-primary text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 hover:opacity-95 transition-all text-sm"
              >
                Pay & Subscribe (£{priceInfo.totalBill})
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const faqs = [
    {
      q: "Can I migrate my existing patient data?",
      a: "Yes! Essentials users get a self-service CSV template. Growth includes guided migration and Scale includes full concierge migration. All migrations completed within 3-5 business days."
    },
    {
      q: "What happens if I exceed my WhatsApp journeys or AI credits?",
      a: "You can purchase AI Booster Packs anytime. WhatsApp journey top-ups coming soon."
    },
    {
      q: "Can I cancel anytime?",
      a: "Monthly plans cancel anytime. Yearly plans refundable within 30 days of purchase."
    }
  ]

  return (
    <div className="bg-card border border-border rounded-xl p-6 card-shadow mt-6">
      <h2 className="text-xl font-bold text-text font-bricolage mb-6">Frequently Asked Questions</h2>
      <div className="space-y-4">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx
          return (
            <div key={idx} className="border-b border-border last:border-0 pb-4 last:pb-0">
              <button
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                type="button"
                className="w-full flex items-center justify-between text-left font-semibold text-text hover:text-primary transition-colors py-2 cursor-pointer"
              >
                <span>{faq.q}</span>
                <span className="ml-4 shrink-0">
                  {isOpen ? (
                    <Minus className="w-4 h-4 text-primary" />
                  ) : (
                    <Plus className="w-4 h-4 text-text/40" />
                  )}
                </span>
              </button>
              {isOpen && (
                <p className="text-sm text-text/60 mt-2 leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
                  {faq.a}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
