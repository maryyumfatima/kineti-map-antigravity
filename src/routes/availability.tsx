import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Clock, Save, Plug, ChevronDown } from 'lucide-react'
import { useRef } from 'react'
import { formatLocalTime } from '../lib/date'

export const Route = createFileRoute('/availability')({
  component: AvailabilityPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type DaySchedule = {
  enabled: boolean
  start: string
  end: string
}

type WeeklySchedule = Record<string, DaySchedule>

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const DEFAULT_SCHEDULE: WeeklySchedule = Object.fromEntries(
  DAYS.map((d) => [d, { enabled: !['Saturday', 'Sunday'].includes(d), start: '09:00', end: '17:00' }])
)

// ─── Integration Cards ────────────────────────────────────────────────────────

type IntegrationCard = {
  name: string
  logo: React.ReactNode
  description: string
  buttonLabel: string
}

function GoogleCalendarLogo() {
  return (
    <svg viewBox="0 0 64 64" className="w-10 h-10" aria-label="Google Calendar">
      <rect width="64" height="64" rx="8" fill="#fff" stroke="#E0EEF0" strokeWidth="1" />
      <rect x="8" y="16" width="48" height="40" rx="4" fill="#fff" stroke="#4285F4" strokeWidth="2" />
      <rect x="8" y="16" width="48" height="12" rx="4" fill="#4285F4" />
      <rect x="8" y="23" width="48" height="5" fill="#4285F4" />
      <rect x="20" y="8" width="4" height="14" rx="2" fill="#4285F4" />
      <rect x="40" y="8" width="4" height="14" rx="2" fill="#4285F4" />
      <text x="32" y="47" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#4285F4">31</text>
    </svg>
  )
}

function CalendlyLogo() {
  return (
    <div className="w-10 h-10 rounded-lg bg-[#006BFF] flex items-center justify-center text-white font-bold text-lg font-bricolage">
      C
    </div>
  )
}

function OutlookLogo() {
  return (
    <div className="w-10 h-10 rounded-lg bg-[#0078D4] flex items-center justify-center">
      <svg viewBox="0 0 32 32" className="w-6 h-6" fill="white">
        <path d="M19 4v7h7l-7-7z"/>
        <path d="M17 4H7a2 2 0 00-2 2v20a2 2 0 002 2h18a2 2 0 002-2V13h-8a2 2 0 01-2-2V4z"/>
        <ellipse cx="11" cy="19" rx="4" ry="5" fill="#0078D4" stroke="white" strokeWidth="1.5"/>
      </svg>
    </div>
  )
}

function AcuityLogo() {
  return (
    <div className="w-10 h-10 rounded-lg bg-[#E74C3C] flex items-center justify-center text-white font-bold text-lg">
      A
    </div>
  )
}

function AppleCalendarLogo() {
  return (
    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 flex items-center justify-center">
      <svg viewBox="0 0 32 32" className="w-6 h-6">
        <rect x="2" y="6" width="28" height="24" rx="4" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="2" y="6" width="28" height="8" rx="4" fill="#FA3E3E" />
        <rect x="2" y="11" width="28" height="3" fill="#FA3E3E" />
        <rect x="9" y="2" width="3" height="7" rx="1.5" fill="#555" />
        <rect x="20" y="2" width="3" height="7" rx="1.5" fill="#555" />
        <text x="16" y="26" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1a1a1a">
          {new Date().getDate()}
        </text>
      </svg>
    </div>
  )
}

const INTEGRATIONS: IntegrationCard[] = [
  {
    name: 'Google Calendar',
    logo: <GoogleCalendarLogo />,
    description: 'Sync your KinetiMap sessions with Google Calendar — two-way, automatic.',
    buttonLabel: 'Connect Google Calendar',
  },
  {
    name: 'Apple Calendar / iCal',
    logo: <AppleCalendarLogo />,
    description: 'Import and export your iCal feed to keep your Apple Calendar in sync.',
    buttonLabel: 'Connect Apple Calendar',
  },
  {
    name: 'Calendly',
    logo: <CalendlyLogo />,
    description: 'Import your Calendly availability into KinetiMap automatically.',
    buttonLabel: 'Connect Calendly',
  },
  {
    name: 'Microsoft Outlook / Teams',
    logo: <OutlookLogo />,
    description: 'Sync with Outlook Calendar or Microsoft Teams schedule.',
    buttonLabel: 'Connect Outlook',
  },
  {
    name: 'Acuity Scheduling',
    logo: <AcuityLogo />,
    description: 'Connect Acuity Scheduling to sync your appointment blocks.',
    buttonLabel: 'Connect Acuity',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

function AvailabilityPage() {
  const { country } = useParams({ strict: false }) as { }
  const navigate = useNavigate()
  const [schedule, setSchedule] = useState<WeeklySchedule>(DEFAULT_SCHEDULE)
  const [saving, setSaving] = useState(false)
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([])
  const [loadingBookings, setLoadingBookings] = useState(false)
  const [integrationsOpen, setIntegrationsOpen] = useState(false)
  const integrationsRef = useRef<HTMLDivElement>(null)
  const [clinicTimezone, setClinicTimezone] = useState<string>('Europe/London')

  useEffect(() => {
    loadSchedule()
  }, [])

  useEffect(() => {
    if (clinicId) {
      fetchUpcomingBookings()
    }
  }, [clinicId])

  const loadSchedule = async () => {
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
      setClinicId(cu.clinic_id)

      const { data } = await supabase
        .from('clinics')
        .select('weekly_schedule, timezone')
        .eq('id', cu.clinic_id)
        .single()

      if (data?.weekly_schedule) setSchedule(data.weekly_schedule)
      if (data?.timezone) setClinicTimezone(data.timezone)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchUpcomingBookings = async () => {
    setLoadingBookings(true)
    try {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('bookings')
        .select('*, patients(full_name)')
        .eq('clinic_id', clinicId)
        .neq('status', 'cancelled')
        .gt('appointment_time', now)
        .order('appointment_time', { ascending: true })
        .limit(20)

      if (error) throw error
      setUpcomingBookings(data || [])
    } catch (e) {
      console.error('Error fetching bookings:', e)
    } finally {
      setLoadingBookings(false)
    }
  }

  const handleSave = async () => {
    if (!clinicId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('clinics')
        .update({ weekly_schedule: schedule })
        .eq('id', clinicId)
      if (error) throw error
      toast.success('Availability saved!')
    } catch {
      toast.error('Failed to save availability')
    } finally {
      setSaving(false)
    }
  }

  const handleComingSoon = (name: string) => {
    toast.info(`Coming Soon — ${name} integration is on our roadmap`, { duration: 3500 })
  }

  const toggleDay = (day: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled }
    }))
  }

  const updateDay = (day: string, field: 'start' | 'end', value: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }))
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-[28px] font-bold text-primary font-bricolage mb-8">Availability</h1>

        {/* ── Integration Cards (collapsed by default) ── */}
        <div className="mb-6">
          {/* Trigger bar */}
          <button
            onClick={() => setIntegrationsOpen(o => !o)}
            className="w-full flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3 cursor-pointer hover:bg-background transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-text">
              <Plug className="w-4 h-4 text-primary" />
              Connect a calendar app
            </div>
            <ChevronDown
              className={`w-4 h-4 text-text/50 transition-transform duration-300 ${integrationsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Animated panel */}
          <div
            style={{
              maxHeight: integrationsOpen
                ? `${integrationsRef.current?.scrollHeight ?? 1200}px`
                : '0px',
              overflow: 'hidden',
              transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <div ref={integrationsRef} className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {INTEGRATIONS.map((integration) => (
                  <div
                    key={integration.name}
                    className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {integration.logo}
                      <span className="shrink-0 text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200 px-2.5 py-1 rounded-full">
                        Not connected
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-text text-sm mb-1">{integration.name}</p>
                      <p className="text-text/60 text-xs leading-relaxed">{integration.description}</p>
                    </div>
                    <button
                      onClick={() => handleComingSoon(integration.name)}
                      className="mt-auto w-full border border-primary text-primary text-sm font-medium py-2 rounded-lg hover:bg-primary hover:text-white transition-colors"
                    >
                      {integration.buttonLabel}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 border-t border-border" />
          <span className="text-sm font-medium text-text/50 whitespace-nowrap">Or set your availability manually</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* ── Weekly Schedule ── */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-text">Weekly Schedule</h2>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 flex items-center gap-2 disabled:opacity-60 transition-all"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save Schedule'}
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-text/60">Loading schedule…</div>
          ) : (
            <div className="divide-y divide-border">
              {DAYS.map((day) => {
                const dayData = schedule[day]
                return (
                  <div
                    key={day}
                    className={`flex items-center gap-4 px-5 py-4 transition-colors ${!dayData.enabled ? 'bg-background/50' : ''}`}
                  >
                    {/* Toggle */}
                    <button
                      onClick={() => toggleDay(day)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${dayData.enabled ? 'bg-primary' : 'bg-gray-300'}`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${dayData.enabled ? 'translate-x-4' : 'translate-x-1'}`}
                      />
                    </button>

                    {/* Day name */}
                    <span className={`w-28 text-sm font-medium ${dayData.enabled ? 'text-text' : 'text-text/40'}`}>
                      {day}
                    </span>

                    {/* Time inputs */}
                    {dayData.enabled ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={dayData.start}
                          onChange={e => updateDay(day, 'start', e.target.value)}
                          className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                        />
                        <span className="text-text/40 text-sm">to</span>
                        <input
                          type="time"
                          value={dayData.end}
                          onChange={e => updateDay(day, 'end', e.target.value)}
                          className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                        />
                        <span className="text-xs text-text/40">
                          {(() => {
                            const [sh, sm] = dayData.start.split(':').map(Number)
                            const [eh, em] = dayData.end.split(':').map(Number)
                            const mins = (eh * 60 + em) - (sh * 60 + sm)
                            if (mins <= 0) return ''
                            const h = Math.floor(mins / 60)
                            const m = mins % 60
                            return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
                          })()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-text/40 italic">Day off</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Upcoming Bookings ── */}
        <div className="mt-12 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text font-bricolage">Upcoming Appointments</h2>
            <button 
              onClick={() => navigate({ to: '/sessions' })}
              className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
            >
              View All <ChevronDown className="w-4 h-4 -rotate-90" />
            </button>
          </div>

          {loadingBookings ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map(i => <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse" />)}
            </div>
          ) : upcomingBookings.length === 0 ? (
            <div className="p-12 bg-white border border-dashed border-border rounded-2xl text-center">
              <p className="text-text/40 text-sm">No upcoming appointments scheduled.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Group by Date */}
              {Object.entries(
                upcomingBookings.reduce((acc: any, b) => {
                  const date = formatLocalTime(b.appointment_time, country, 'EEEE, MMMM d', clinicTimezone)
                  if (!acc[date]) acc[date] = []
                  acc[date].push(b)
                  return acc
                }, {})
              ).map(([date, dayBookings]: [string, any]) => (
                <div key={date} className="space-y-4">
                  <h3 className="text-[10px] font-bold text-text/30 uppercase tracking-widest pl-1">{date}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dayBookings.map((b: any) => (
                      <div key={b.id} className="bg-white border border-border rounded-xl p-4 shadow-sm hover:border-primary/20 transition-all group">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-text text-sm">{b.patients?.full_name || 'Unknown Patient'}</span>
                            <span className="text-[11px] text-text/50">{formatLocalTime(b.appointment_time, country, 'h:mm a', clinicTimezone)} • {b.duration || 30} mins</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${
                            b.status === 'confirmed' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-orange-50 text-orange-600 border-orange-100'
                          }`}>
                            {b.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-border/50">
                          <span className="text-[10px] font-medium text-text/40">{b.appointment_type || 'Follow-up'}</span>
                          <button className="text-[10px] font-bold text-primary group-hover:underline">Details</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
