import { createFileRoute, useParams } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Calendar, Plus, X } from 'lucide-react'
import { formatLocalTime, toUtcString, getTimezoneAbbr } from '../lib/date'

export const Route = createFileRoute('/$country/sessions')({
  component: SessionsPage,
})

type Booking = {
  id: string
  patient_id: string
  clinic_id: string
  appointment_time: string
  appointment_type: 'initial' | 'follow_up' | 'assessment' | 'discharge'
  status: 'upcoming' | 'completed' | 'no_show' | 'cancelled'
  pain_data: Record<string, unknown> | null
  notes: string | null
  session_completed_at: string | null
  patients?: { full_name: string }
}

type Patient = {
  id: string
  full_name: string
}

const typeColors: Record<string, string> = {
  initial: 'bg-primary/10 text-primary border-primary/20',
  follow_up: 'bg-[#D9B29C]/20 text-[#B88B71] border-[#D9B29C]/30',
  assessment: 'bg-purple-100 text-purple-700 border-purple-200',
  discharge: 'bg-gray-100 text-gray-700 border-gray-200',
}

const statusColors: Record<string, string> = {
  upcoming: 'bg-sky-100 text-sky-700 border-sky-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  no_show: 'bg-alert/10 text-alert border-alert/20',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
}

const typeLabels: Record<string, string> = {
  initial: 'Initial',
  follow_up: 'Follow-up',
  assessment: 'Assessment',
  discharge: 'Discharge',
}

const statusLabels: Record<string, string> = {
  upcoming: 'Upcoming',
  completed: 'Completed',
  no_show: 'No Show',
  cancelled: 'Cancelled',
}

function SessionsPage() {
  const { country } = useParams({ strict: false }) as { country: string }
  const [bookings, setBookings] = useState<Booking[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [clinicTimezone, setClinicTimezone] = useState<string>('Europe/London')

  const [formData, setFormData] = useState({
    patient_id: '',
    date: '',
    time: '',
    appointment_type: 'initial',
    notes: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const getClinicId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: cu } = await supabase
      .from('clinic_users')
      .select('clinic_id')
      .eq('auth_user_id', user.id)
      .single()
    
    if (!cu) return null
    
    const { data: clinic } = await supabase
      .from('clinics')
      .select('id, timezone')
      .eq('id', cu.clinic_id)
      .single()
    
    if (clinic) setClinicTimezone(clinic.timezone || 'Europe/London')
    return cu?.clinic_id ?? null
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const id = await getClinicId()
      if (!id) return
      setClinicId(id)

      const [bookingsRes, patientsRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, patients(full_name)')
          .eq('clinic_id', id)
          .order('appointment_time', { ascending: false }),
        supabase
          .from('patients')
          .select('id, full_name')
          .eq('clinic_id', id)
          .order('full_name'),
      ])

      if (bookingsRes.error) throw bookingsRes.error
      if (patientsRes.error) throw patientsRes.error

      setBookings(bookingsRes.data ?? [])
      setPatients(patientsRes.data ?? [])
    } catch (e) {
      console.error(e)
      toast.error('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkComplete = async (id: string) => {
    setUpdatingId(id)
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'completed', session_completed_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      toast.success('Session marked as completed')
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'completed', session_completed_at: new Date().toISOString() } : b))
    } catch {
      toast.error('Failed to update session')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleMarkNoShow = async (id: string) => {
    setUpdatingId(id)
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'no_show' })
        .eq('id', id)
      if (error) throw error
      toast.success('Session marked as no-show')
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'no_show' } : b))
    } catch {
      toast.error('Failed to update session')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clinicId || !formData.patient_id || !formData.date || !formData.time) {
      toast.error('Please fill all required fields')
      return
    }
    setIsSaving(true)
    try {
      const appointment_time = toUtcString(`${formData.date}T${formData.time}`, country, clinicTimezone)
      const { error } = await supabase.from('bookings').insert([{
        clinic_id: clinicId,
        patient_id: formData.patient_id,
        appointment_time,
        appointment_type: formData.appointment_type,
        notes: formData.notes || null,
        status: 'upcoming',
      }])
      if (error) throw error
      toast.success('Session added successfully')
      setIsModalOpen(false)
      setFormData({ patient_id: '', date: '', time: '', appointment_type: 'initial', notes: '' })
      fetchData()
    } catch {
      toast.error('Failed to save session')
    } finally {
      setIsSaving(false)
    }
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm bg-white'

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-[28px] font-bold text-primary font-bricolage">Sessions</h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-premium bg-primary hover:opacity-90 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" /> Add Session
          </button>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden card-shadow transition-premium">
          {loading ? (
            <div className="p-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b border-border last:border-0">
                  <div className="w-10 h-10 rounded-full skeleton" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/4 skeleton" />
                    <div className="h-3 w-1/6 skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-6">
                <Calendar className="w-10 h-10 text-primary/30" />
              </div>
              <h3 className="text-xl font-bold text-text font-bricolage mb-2">No sessions yet</h3>
              <p className="text-text/50 max-w-sm mb-8">
                Your appointment schedule is empty. Add a session to start tracking your patient visits.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-premium bg-primary text-white px-6 py-2.5 rounded-lg shadow-lg shadow-primary/20 flex items-center gap-2 hover:opacity-90"
              >
                <Plus className="w-5 h-5" /> Schedule First Session
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background/50 border-b border-border text-sm font-medium text-text/70">
                    <th className="p-4">Patient</th>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Pain Areas</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => {
                      const painAreas = booking.pain_data
                      ? Object.keys(booking.pain_data).join(', ')
                      : '—'
                    
                    return (
                      <tr key={booking.id} className="border-b border-border last:border-0 hover:bg-background/30 transition-colors">
                        <td className="p-4 font-medium text-text">
                          {booking.patients?.full_name ?? '—'}
                        </td>
                        <td className="p-4 text-sm text-text/80 whitespace-nowrap">
                          <div>{formatLocalTime(booking.appointment_time, country, 'MMM d, yyyy', clinicTimezone)}</div>
                          <div className="text-text/50">{formatLocalTime(booking.appointment_time, country, 'h:mm a', clinicTimezone)} {getTimezoneAbbr(country, new Date(booking.appointment_time), clinicTimezone)}</div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${typeColors[booking.appointment_type] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                            {typeLabels[booking.appointment_type] ?? booking.appointment_type}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColors[booking.status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                            {statusLabels[booking.status] ?? booking.status}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-text/70 max-w-[160px] truncate">{painAreas}</td>
                        <td className="p-4">
                          {booking.status === 'upcoming' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleMarkComplete(booking.id)}
                                disabled={updatingId === booking.id}
                                className="text-xs bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                              >
                                Mark Complete
                              </button>
                              <button
                                onClick={() => handleMarkNoShow(booking.id)}
                                disabled={updatingId === booking.id}
                                className="text-xs bg-alert/10 border border-alert/20 text-alert hover:bg-alert/20 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                              >
                                No-Show
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-primary font-bricolage">Add Session</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-text/50 hover:text-text"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form id="add-session-form" onSubmit={handleSaveSession} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Patient *</label>
                  <select required value={formData.patient_id} onChange={e => setFormData({ ...formData, patient_id: e.target.value })} className={inputClass}>
                    <option value="">Select patient…</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-text mb-1">Date *</label>
                    <input required type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text mb-1">Time *</label>
                    <input required type="time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Appointment type</label>
                  <select value={formData.appointment_type} onChange={e => setFormData({ ...formData, appointment_type: e.target.value })} className={inputClass}>
                    <option value="initial">Initial</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="assessment">Assessment</option>
                    <option value="discharge">Discharge</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Notes</label>
                  <textarea rows={3} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className={`${inputClass} resize-none`} placeholder="Optional notes…" />
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-border bg-background rounded-b-2xl flex justify-end gap-3 sticky bottom-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg font-medium text-text hover:bg-black/5 transition-colors text-sm">Cancel</button>
              <button type="submit" form="add-session-form" disabled={isSaving} className="bg-primary hover:opacity-90 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-70 text-sm">
                {isSaving ? 'Saving…' : 'Save Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
