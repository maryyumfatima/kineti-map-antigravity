import { createFileRoute, useParams } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { CheckCircle, DollarSign } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { formatLocalTime, getZonedDate } from '../lib/date'

export const Route = createFileRoute('/revenue')({
  component: RevenuePage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type LedgerRow = {
  id: string
  booking_id: string
  patient_id: string
  amount: number
  currency: string
  payment_status: 'paid' | 'unpaid'
  recorded_at: string
  patients?: { full_name: string }
  bookings?: { appointment_time: string; appointment_type: string }
}

type MonthlySummary = {
  month: string
  sessions: number
  collected: number
  unpaid: number
  net: number
}

type ChartDatum = {
  type: string
  total: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function last6Months(): { label: string; year: number; month: number }[] {
  const result = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({ label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear(), month: d.getMonth() })
  }
  return result
}

const TYPE_LABELS: Record<string, string> = {
  initial: 'Initial', follow_up: 'Follow-up', assessment: 'Assessment', discharge: 'Discharge',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function RevenuePage() {
    const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [upcomingCount, setUpcomingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState<string | null>(null)

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

      const [ledgerRes, upcomingRes] = await Promise.all([
        supabase
          .from('cash_ledger')
          .select('*, patients(full_name), bookings(appointment_time, appointment_type)')
          .eq('clinic_id', cid)
          .order('recorded_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', cid)
          .eq('status', 'upcoming'),
      ])

      if (ledgerRes.error) throw ledgerRes.error
      setLedger(ledgerRes.data ?? [])
      setUpcomingCount(upcomingRes.count ?? 0)
    } catch {
      toast.error('Failed to load revenue data')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkPaid = async (id: string) => {
    setMarkingId(id)
    try {
      const { error } = await supabase
        .from('cash_ledger')
        .update({ payment_status: 'paid' })
        .eq('id', id)
      if (error) throw error
      toast.success('Session marked as paid')
      setLedger(prev => prev.map(r => r.id === id ? { ...r, payment_status: 'paid' } : r))
    } catch {
      toast.error('Failed to update payment status')
    } finally {
      setMarkingId(null)
    }
  }

  // ── Derived stats ────────────────────────────────────────────────────────

  const paid = ledger.filter(r => r.payment_status === 'paid')
  const unpaid = ledger.filter(r => r.payment_status === 'unpaid')

  const totalCollected = paid.reduce((a, r) => a + r.amount, 0)

  const nowZoned = getZonedDate(new Date(), 'Europe/London')
  const firstOfMonth = new Date(nowZoned.getFullYear(), nowZoned.getMonth(), 1)
  
  const thisMonth = paid
    .filter(r => new Date(r.recorded_at) >= firstOfMonth)
    .reduce((a, r) => a + r.amount, 0)

  // ── Chart data ────────────────────────────────────────────────────────────

  const chartData: ChartDatum[] = Object.entries(
    paid.reduce<Record<string, number>>((acc, r) => {
      const type = r.bookings?.appointment_type ?? 'unknown'
      acc[type] = (acc[type] ?? 0) + r.amount
      return acc
    }, {})
  ).map(([type, total]) => ({ type: TYPE_LABELS[type] ?? type, total }))

  // ── Monthly summary ───────────────────────────────────────────────────────

  const months = last6Months()
  const monthlySummary: MonthlySummary[] = months.map(({ label, year, month }) => {
    const rows = ledger.filter(r => {
      const d = new Date(r.recorded_at)
      return d.getFullYear() === year && d.getMonth() === month
    })
    const sessions = rows.length
    const collected = rows.filter(r => r.payment_status === 'paid').reduce((a, r) => a + r.amount, 0)
    const unpaidAmt = rows.filter(r => r.payment_status === 'unpaid').reduce((a, r) => a + r.amount, 0)
    return { month: label, sessions, collected, unpaid: unpaidAmt, net: collected - unpaidAmt }
  })

  // ─── Render ───────────────────────────────────────────────────────────────

  const StatCard = ({
    label, value, sub, amber = false,
  }: { label: string; value: React.ReactNode; sub?: string; amber?: boolean }) => (
    <div className={`bg-card rounded-xl p-5 shadow-sm flex flex-col gap-1 border ${amber ? 'border-amber-300' : 'border-border'}`}>
      <span className="text-xs font-medium text-text/50 uppercase tracking-wide">{label}</span>
      <span className="text-[28px] font-bold font-bricolage text-primary leading-none mt-1">{value}</span>
      {sub && <span className="text-xs text-text/40 mt-1">{sub}</span>}
    </div>
  )

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-[28px] font-bold text-primary font-bricolage mb-8">Revenue</h1>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Projected Revenue"
            value={`${upcomingCount} sessions`}
            sub="upcoming bookings"
          />
          <StatCard
            label="Actual Collected"
            value={fmt(totalCollected)}
            sub="all time"
          />
          <StatCard
            label="Unpaid Sessions"
            value={unpaid.length}
            sub={`${fmt(unpaid.reduce((a, r) => a + r.amount, 0))} outstanding`}
            amber
          />
          <StatCard
            label="This Month"
            value={fmt(thisMonth)}
            sub={formatLocalTime(new Date().toISOString(), 'GB', 'MMMM yyyy', 'Europe/London')}
          />
        </div>

        {/* ── Unpaid Sessions ── */}
        <div className="bg-card border border-border rounded-xl shadow-sm mb-8 overflow-hidden">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-alert" />
            <h2 className="font-bold text-alert font-bricolage">Unpaid Sessions</h2>
            {unpaid.length > 0 && (
              <span className="ml-1 text-xs font-bold bg-alert/10 text-alert border border-alert/20 px-2 py-0.5 rounded-full">
                {unpaid.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-text/60">Loading…</div>
          ) : unpaid.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-text/50">
              <CheckCircle className="w-10 h-10 text-green-400" />
              <p className="font-medium text-text/70">All sessions are paid.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background/50 border-b border-border text-sm font-medium text-text/70">
                    <th className="p-4">Patient</th>
                    <th className="p-4">Session Date</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {unpaid.map(row => (
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-background/30 transition-colors border-l-2 border-l-amber-400">
                      <td className="p-4 font-medium text-text">{row.patients?.full_name ?? '—'}</td>
                      <td className="p-4 text-sm text-text/70">
                        {row.bookings?.appointment_time
                          ? formatLocalTime(row.bookings.appointment_time, 'GB', 'MMM d, yyyy', 'Europe/London')
                          : '—'}
                      </td>
                      <td className="p-4 font-semibold text-text">
                        {fmt(row.amount)}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleMarkPaid(row.id)}
                          disabled={markingId === row.id}
                          className="text-xs bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          {markingId === row.id ? 'Saving…' : 'Mark Paid'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Revenue by Treatment Type ── */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-5 mb-8">
          <h2 className="font-bold text-text font-bricolage mb-5">Revenue by Treatment Type</h2>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-text/40 italic">No collected revenue yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0EEF0" vertical={false} />
                <XAxis dataKey="type" tick={{ fontSize: 12, fill: '#32323f', opacity: 0.6 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#32323f', opacity: 0.6 }} axisLine={false} tickLine={false} tickFormatter={v => `£${v}`} />
                <Tooltip
                  formatter={(v: any) => v !== undefined ? [fmt(v as number), ''] : ['', '']}
                  contentStyle={{ borderRadius: 8, borderColor: '#E0EEF0', fontSize: 13 }}
                />
                <Bar dataKey="total" fill="#006D77" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Monthly Summary ── */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-bold text-text font-bricolage">Monthly Summary</h2>
            <p className="text-xs text-text/50 mt-0.5">Last 6 months</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background/50 border-b border-border text-sm font-medium text-text/70">
                  <th className="p-4">Month</th>
                  <th className="p-4 text-right">Sessions</th>
                  <th className="p-4 text-right">Collected</th>
                  <th className="p-4 text-right">Unpaid</th>
                  <th className="p-4 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map(row => (
                  <tr key={row.month} className="border-b border-border last:border-0 hover:bg-background/30 transition-colors">
                    <td className="p-4 font-medium text-text">{row.month}</td>
                    <td className="p-4 text-right text-text/80">{row.sessions}</td>
                    <td className="p-4 text-right text-green-700 font-medium">{fmt(row.collected)}</td>
                    <td className="p-4 text-right text-amber-600 font-medium">{fmt(row.unpaid)}</td>
                    <td className={`p-4 text-right font-semibold ${row.net >= 0 ? 'text-text' : 'text-alert'}`}>
                      {fmt(row.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}
