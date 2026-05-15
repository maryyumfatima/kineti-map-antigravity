import { createFileRoute, useParams } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import {
  Users, Calendar, MessageSquare, CreditCard,
  CheckCircle, AlertCircle, Clock, ChevronRight
} from 'lucide-react'
import { formatLocalTime, getTimezoneAbbr, toUtcString } from '../lib/date'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
})

type StatCardProps = {
  title: string
  value: string | number
  icon: any
  color?: string
  loading?: boolean
}

function StatCard({ title, value, icon: Icon, color = 'text-primary', loading }: StatCardProps) {
  return (
    <div className="bg-card rounded-2xl p-4 md:p-6 border border-border shadow-sm flex flex-col">
      <div className="flex justify-between items-start mb-3 md:mb-4">
        <div className={`p-1.5 md:p-2 rounded-xl bg-background border border-border ${color}`}>
          <Icon className="w-4 h-4 md:w-5 md:h-5" />
        </div>
      </div>
      {loading ? (
        <div className="h-8 md:h-10 w-16 md:w-20 bg-gray-100 animate-pulse rounded-lg mb-2" />
      ) : (
        <span className={`text-[28px] md:text-[36px] font-bold font-bricolage mb-1 leading-none ${color}`}>
          {value}
        </span>
      )}
      <span className="text-text/50 font-medium text-xs md:text-sm">
        {title}
      </span>
    </div>
  )
}

function Dashboard() {
  const { country } = useParams({ strict: false }) as { }
  const [loading, setLoading] = useState(true)

  // Stats
  const [todaySessionsCount, setTodaySessionsCount] = useState(0)
  const [activePatientsCount, setActivePatientsCount] = useState(0)
  const [avgFeedback, setAvgFeedback] = useState<number | null>(null)
  const [unpaidCount, setUnpaidCount] = useState(0)

  // Lists
  const [todayBookings, setTodayBookings] = useState<any[]>([])
  const [lowScoreAlerts, setLowScoreAlerts] = useState<any[]>([])

  const [updatingBooking, setUpdatingBooking] = useState<string | null>(null)
  const [clinicTimezone, setClinicTimezone] = useState<string>('Europe/London')

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: cu } = await supabase
        .from('clinic_users')
        .select('clinic_id')
        .eq('auth_user_id', user.id)
        .single()

      if (!cu) return
      const myClinicId = cu.clinic_id

      const { data: clinic } = await supabase
        .from('clinics')
        .select('timezone')
        .eq('id', myClinicId)
        .single()
      
      const tz = clinic?.timezone || 'Europe/London'
      setClinicTimezone(tz)

      // Calculate today's start/end in clinic timezone
      const nowInClinic = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
      nowInClinic.setHours(0,0,0,0)
      
      const todayStart = toUtcString(nowInClinic.toISOString().split('T')[0] + ' 00:00:00', country, tz)
      const tomorrowStart = toUtcString(nowInClinic.toISOString().split('T')[0] + ' 23:59:59', country, tz)
      const thirtyDaysAgo = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // 1. Today's Sessions Count
      const { count: sessionCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', myClinicId)
        .gte('appointment_time', todayStart)
        .lt('appointment_time', tomorrowStart)
        .eq('status', 'upcoming')

      setTodaySessionsCount(sessionCount || 0)

      // 2. Active Patients Count
      const { count: patientCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', myClinicId)
        .eq('status_tag', 'active')
        .eq('is_deleted', false)

      setActivePatientsCount(patientCount || 0)

      // 3. Avg Feedback Score
      const { data: feedbackData } = await supabase
        .from('feedback')
        .select('score')
        .eq('clinic_id', myClinicId)
        .gte('created_at', thirtyDaysAgo)

      if (feedbackData && feedbackData.length > 0) {
        const sum = feedbackData.reduce((acc, f) => acc + f.score, 0)
        setAvgFeedback(parseFloat((sum / feedbackData.length).toFixed(1)))
      }

      // 4. Unpaid Sessions Count
      const { count: unpaid } = await supabase
        .from('cash_ledger')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', myClinicId)
        .eq('payment_status', 'unpaid')

      setUnpaidCount(unpaid || 0)

      // 5. Today's Bookings List
      const { data: bList } = await supabase
        .from('bookings')
        .select('*, patients(full_name)')
        .eq('clinic_id', myClinicId)
        .gte('appointment_time', todayStart)
        .lt('appointment_time', tomorrowStart)
        .order('appointment_time', { ascending: true })

      setTodayBookings(bList || [])

      // 6. Low Score Alerts
      const { data: fList } = await supabase
        .from('feedback')
        .select('*, patients(full_name)')
        .eq('clinic_id', myClinicId)
        .lte('score', 6)
        .order('created_at', { ascending: false })

      setLowScoreAlerts(fList || [])

    } catch (e) {
      console.error(e)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const updateBookingStatus = async (bookingId: string, status: string) => {
    setUpdatingBooking(bookingId)
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', bookingId)

      if (error) throw error
      setTodayBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b))
      toast.success(`Session marked as ${status}`)
    } catch {
      toast.error('Failed to update session')
    } finally {
      setUpdatingBooking(null)
    }
  }

  const getFeedbackColor = (score: number | null) => {
    if (score === null) return 'text-text/30'
    if (score >= 8) return 'text-green-600'
    if (score >= 5) return 'text-amber-600'
    return 'text-red-600'
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto pb-12">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-1 md:gap-0 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-[28px] font-bold text-primary font-bricolage leading-tight">Dashboard Overview</h1>
            <p className="text-text/50 text-sm mt-1">Here's what's happening today at your clinic.</p>
          </div>
          <div className="md:text-right">
            <p className="text-sm font-semibold text-text">{formatLocalTime(new Date().toISOString(), country, 'EEEE, MMMM d', clinicTimezone)}</p>
            <p className="text-xs text-text/40 mt-0.5">Real-time metrics ({getTimezoneAbbr(country, new Date(), clinicTimezone)})</p>
          </div>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-10">
          <StatCard
            title="Today's Sessions"
            value={todaySessionsCount}
            icon={Calendar}
            loading={loading}
          />
          <StatCard
            title="Active Patients"
            value={activePatientsCount}
            icon={Users}
            loading={loading}
          />
          <StatCard
            title="Avg Feedback Score"
            value={avgFeedback ?? '--'}
            icon={MessageSquare}
            color={getFeedbackColor(avgFeedback)}
            loading={loading}
          />
          <StatCard
            title="Unpaid Sessions"
            value={unpaidCount}
            icon={CreditCard}
            color={unpaidCount > 0 ? 'text-amber-600' : 'text-primary'}
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">

          {/* LEFT: TODAY'S SESSIONS */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border flex justify-between items-center bg-white">
              <h2 className="font-bold text-text font-bricolage flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Today's Sessions
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-text/30">{getTimezoneAbbr(country, new Date(), clinicTimezone)}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-text/30">{todayBookings.length} total</span>
              </div>
            </div>

            <div className="flex-1">
              {todayBookings.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 bg-background border border-dashed border-border rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-5 h-5 text-text/20" />
                  </div>
                  <p className="text-sm font-medium text-text/40">No sessions scheduled for today.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {todayBookings.map((booking) => (
                    <div key={booking.id} className="p-5 hover:bg-background/30 transition-colors">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-start gap-4">
                          <div className="text-center min-w-[60px] pt-1">
                            <p className="text-sm font-bold text-primary font-bricolage">
                              {formatLocalTime(booking.appointment_time, country, 'HH:mm', clinicTimezone)}
                            </p>
                          </div>
                          <div>
                            <p className="font-bold text-text">{booking.patients?.full_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-bold bg-background border border-border px-2 py-0.5 rounded text-text/50 uppercase">
                                {booking.appointment_type?.replace('_', ' ') ?? ''}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${booking.status === 'completed' ? 'bg-green-50 border-green-100 text-green-600' :
                                  booking.status === 'upcoming' ? 'bg-sky-50 border-sky-100 text-sky-600' :
                                    'bg-gray-50 border-gray-100 text-gray-500'
                                }`}>
                                {booking.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        {booking.status === 'upcoming' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'completed')}
                              disabled={updatingBooking === booking.id}
                              className="p-2 rounded-lg hover:bg-green-50 text-green-600 transition-colors disabled:opacity-50"
                              title="Mark Complete"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'no_show')}
                              disabled={updatingBooking === booking.id}
                              className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors disabled:opacity-50"
                              title="Mark No-Show"
                            >
                              <AlertCircle className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {todayBookings.length > 0 && (
              <div className="p-4 border-t border-border bg-background/30">
                <button className="text-xs font-bold text-primary flex items-center gap-1 hover:underline mx-auto">
                  VIEW FULL SCHEDULE
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: LOW SCORE ALERTS */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border flex justify-between items-center bg-white">
              <h2 className="font-bold text-text font-bricolage flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-alert" />
                Low Score Alerts
              </h2>
            </div>

            <div className="flex-1">
              {lowScoreAlerts.length === 0 ? (
                <div className="p-16 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="font-bold text-text mb-1">No alerts — great work!</h3>
                  <p className="text-xs text-text/40">Patients are highly satisfied with your service.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {lowScoreAlerts.map((feedback) => (
                    <div key={feedback.id} className="p-5 hover:bg-background/30 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-bold text-text">{feedback.patients?.full_name}</p>
                        <span className="text-red-600 font-bold font-bricolage text-lg">{feedback.score}</span>
                      </div>
                      <p className="text-sm text-text/70 italic leading-relaxed">"{feedback.comment || 'No comment provided'}"</p>
                      <p className="text-[10px] text-text/40 mt-3 font-medium uppercase tracking-wider">
                        {formatLocalTime(feedback.created_at, country, 'MMM d, yyyy', clinicTimezone)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}