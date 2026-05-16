import { createFileRoute, useParams } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Star } from 'lucide-react'
import { formatLocalTime } from '../lib/date'

export const Route = createFileRoute('/feedback')({
  component: FeedbackPage,
})

type FeedbackRow = {
  id: string
  patient_id: string
  score: number
  comment: string | null
  created_at: string
  alert_triggered: boolean
  review_link_sent: boolean
  patients?: { full_name: string }
}

const FILTERS = ['All', 'Promoters', 'Neutral', 'Alerts'] as const
type Filter = typeof FILTERS[number]

function scoreBadge(score: number) {
  if (score >= 9) return 'bg-green-100 text-green-700 border-green-200'
  if (score >= 7) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-alert/10 text-alert border-alert/20'
}

function avgColor(avg: number) {
  if (avg >= 8) return 'text-green-600'
  if (avg >= 5) return 'text-amber-500'
  return 'text-alert'
}

function FeedbackPage() {
  const country = 'GB'
  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('All')

  useEffect(() => { fetchFeedback() }, [])

  const fetchFeedback = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: cu } = await supabase
        .from('clinic_users').select('clinic_id').eq('auth_user_id', user.id).single()
      if (!cu) return

      const { data, error } = await supabase
        .from('feedback')
        .select('*, patients(full_name)')
        .eq('clinic_id', cu.clinic_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setRows(data ?? [])
    } catch {
      toast.error('Failed to load feedback')
    } finally {
      setLoading(false)
    }
  }

  const filtered = rows.filter(r => {
    if (filter === 'Promoters') return r.score >= 9
    if (filter === 'Neutral') return r.score >= 7 && r.score <= 8
    if (filter === 'Alerts') return r.score <= 6
    return true
  })

  const avg = rows.length ? rows.reduce((a, r) => a + r.score, 0) / rows.length : 0
  const promoters = rows.filter(r => r.score >= 9).length
  const alerts = rows.filter(r => r.score <= 6).length

  const StatCard = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) => (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col gap-1">
      <span className="text-xs font-medium text-text/50 uppercase tracking-wide">{label}</span>
      <span className="text-[32px] font-bold font-bricolage leading-none">{value}</span>
      {sub && <span className="text-xs text-text/50 mt-1">{sub}</span>}
    </div>
  )

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-[28px] font-bold text-primary font-bricolage mb-8">Feedback</h1>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Average Score"
            value={<span className={avgColor(avg)}>{rows.length ? avg.toFixed(1) : '—'}</span>}
            sub="out of 10"
          />
          <StatCard label="Total Reviews" value={<span className="text-primary">{rows.length}</span>} />
          <StatCard
            label="Promoters"
            value={
              <span className="flex items-center gap-2">
                <span className="text-primary">{promoters}</span>
                <span className="text-xs font-semibold bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">score 9-10</span>
              </span>
            }
          />
          <StatCard
            label="Alerts"
            value={
              <span className="flex items-center gap-2">
                <span className="text-primary">{alerts}</span>
                <span className="text-xs font-semibold bg-alert/10 text-alert border border-alert/20 px-2 py-0.5 rounded-full">score 1-6</span>
              </span>
            }
          />
        </div>

        {/* Table card */}
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          {/* Filter tabs */}
          <div className="p-4 border-b border-border flex gap-1 bg-white">
            <div className="flex bg-background p-1 rounded-lg overflow-x-auto">
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    filter === f ? 'bg-card text-primary shadow-sm' : 'text-text/70 hover:text-text'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-text/60">Loading feedback…</div>
          ) : filtered.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-text/50">
              <Star className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-medium text-text/70">No feedback yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background/50 border-b border-border text-sm font-medium text-text/70">
                    <th className="p-4">Patient</th>
                    <th className="p-4">Score</th>
                    <th className="p-4">Comment</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Alert</th>
                    <th className="p-4">Review Link</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => (
                    <tr
                      key={row.id}
                      className={`border-b border-border last:border-0 hover:bg-background/30 transition-colors ${
                        row.score <= 6 ? 'border-l-2 border-l-alert' : ''
                      }`}
                    >
                      <td className="p-4 font-medium text-text">{row.patients?.full_name ?? '—'}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${scoreBadge(row.score)}`}>
                          {row.score}/10
                        </span>
                      </td>
                      <td className="p-4 text-sm text-text/70 max-w-xs truncate">{row.comment || <span className="italic text-text/30">No comment</span>}</td>
                      <td className="p-4 text-sm text-text/60 whitespace-nowrap">{formatLocalTime(row.created_at, country, 'MMM d, yyyy')}</td>
                      <td className="p-4">
                        {row.alert_triggered && (
                          <span className="text-xs font-semibold bg-alert/10 text-alert border border-alert/20 px-2 py-1 rounded-full">Alert Sent</span>
                        )}
                      </td>
                      <td className="p-4">
                        {row.review_link_sent && (
                          <span className="text-xs font-semibold bg-green-100 text-green-700 border border-green-200 px-2 py-1 rounded-full">Sent</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
