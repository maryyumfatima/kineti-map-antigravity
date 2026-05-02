import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { 
  Phone, Mail, Calendar, Info, 
  MessageSquare, History, ChevronRight,
  CheckCircle, Clock, AlertCircle, ExternalLink,
  ChevronDown, ChevronUp, Download, Trash2, ShieldAlert
} from 'lucide-react'
import { exportPatientData, deletePatientData } from '../lib/gdpr'
import { formatLocalTime, getTimezoneAbbr } from '../lib/date'

export const Route = createFileRoute('/$country/dashboard/patients/$id')({
  component: PatientDetailPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type Patient = {
  id: string
  full_name: string
  phone_number: string
  email: string | null
  date_of_birth: string
  gdpr_consent: boolean
  status_tag: string
  referral_source: string | null
  primary_complaint: string | null
  created_at: string
}

type Booking = {
  id: string
  appointment_time: string
  appointment_type: string
  status: string
  pain_data: Record<string, number> | null
  notes: string | null
}

type WhatsAppMessage = {
  id: string
  message_type: string
  scheduled_for: string
  status: 'sent' | 'pending' | 'failed'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateAge(dob: string) {
  if (!dob) return 0
  const birthDate = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

const getStatusColor = (status: string) => {
  switch((status ?? '').toLowerCase()) {
    case 'active': return 'bg-primary/10 text-primary border-primary/20'
    case 'lapsed': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'discharged': return 'bg-gray-100 text-gray-700 border-gray-200'
    case 'no-show': return 'bg-alert/10 text-alert border-alert/20'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

const getBookingStatusColor = (status: string) => {
  switch((status ?? '').toLowerCase()) {
    case 'completed': return 'bg-green-100 text-green-700 border-green-200'
    case 'upcoming': return 'bg-sky-100 text-sky-700 border-sky-200'
    case 'no_show': return 'bg-alert/10 text-alert border-alert/20'
    case 'cancelled': return 'bg-gray-100 text-gray-600 border-gray-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PatientDetailPage() {
  const { id } = Route.useParams()
  const { country } = useParams({ strict: false }) as { country: string }
  const [patient, setPatient] = useState<Patient | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null)
  const [updatingBooking, setUpdatingBooking] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const navigate = Route.useNavigate()

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
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

      // 1. Fetch Patient
      const { data: pData, error: pErr } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .eq('clinic_id', cu.clinic_id)
        .single()
      
      if (pErr) throw pErr
      setPatient(pData)

      // 2. Fetch Bookings
      const { data: bData } = await supabase
        .from('bookings')
        .select('*')
        .eq('patient_id', id)
        .order('appointment_time', { ascending: false })
      
      setBookings(bData ?? [])

      // 3. Fetch WhatsApp Messages
      const { data: mData } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('patient_id', id)
        .order('scheduled_for', { ascending: false })
      
      setMessages(mData ?? [])

    } catch (e: any) {
      console.error(e)
      toast.error('Failed to load patient data')
    } finally {
      setLoading(false)
    }
  }

  const toggleConsent = async () => {
    if (!patient || !clinicId) return
    try {
      const { error } = await supabase
        .from('patients')
        .update({ gdpr_consent: !patient.gdpr_consent })
        .eq('id', patient.id)
      
      if (error) throw error
      setPatient({ ...patient, gdpr_consent: !patient.gdpr_consent })
      toast.success('Consent updated')
    } catch {
      toast.error('Failed to update consent')
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
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b))
      toast.success(`Session marked as ${status}`)
    } catch {
      toast.error('Failed to update session')
    } finally {
      setUpdatingBooking(null)
    }
  }

  const handleExport = async () => {
    if (!patient || !clinicId) return
    setIsExporting(true)
    toast.info('Preparing patient data export...')
    const result = await exportPatientData(patient.id, clinicId)
    if (result.success) {
      toast.success('Patient data exported successfully')
    } else {
      toast.error(`Export failed: ${result.error}`)
    }
    setIsExporting(false)
  }

  const handleDelete = async () => {
    if (!patient || !clinicId || deleteConfirmText !== patient.full_name) return
    setIsDeleting(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    const result = await deletePatientData(patient.id, clinicId, user?.id || 'unknown')
    if (result.success) {
      toast.success('Patient completely removed from system.')
      navigate({ to: '/$country/patients', params: { country } as any })
    } else {
      toast.error(`Deletion failed: ${result.error}`)
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-sm text-text/50">Loading patient details…</div>
      </DashboardLayout>
    )
  }

  if (!patient) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-text/50">
          <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-medium">Patient not found.</p>
          <Link to="/$country/patients" params={{ country } as any} className="mt-4 text-primary hover:underline text-sm font-medium">Back to Patients</Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl font-bricolage border border-primary/20 shadow-sm">
              {patient.full_name[0]}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[28px] font-bold text-primary font-bricolage leading-tight">{patient.full_name}</h1>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(patient.status_tag)}`}>
                  {(patient.status_tag ?? '').charAt(0).toUpperCase() + (patient.status_tag ?? '').slice(1)}
                </span>
              </div>
              <p className="text-sm text-text/50 mt-1">Patient ID: <span className="font-mono">{patient.id.slice(0, 8)}</span></p>
            </div>
          </div>
          <Link 
            to="/$country/patients" 
            params={{ country } as any}
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Patients
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* 1. BASIC INFO */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Info className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-text font-bricolage">Basic Info</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-text/30 mt-1" />
                  <div>
                    <p className="text-xs text-text/40 font-medium uppercase tracking-wider">Phone</p>
                    <p className="text-sm font-medium text-text">{patient.phone_number}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-text/30 mt-1" />
                  <div>
                    <p className="text-xs text-text/40 font-medium uppercase tracking-wider">Email</p>
                    <p className="text-sm font-medium text-text">{patient.email || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-text/30 mt-1" />
                  <div>
                    <p className="text-xs text-text/40 font-medium uppercase tracking-wider">Date of Birth</p>
                    <p className="text-sm font-medium text-text">
                      {formatLocalTime(patient.date_of_birth, country, 'MMM d, yyyy')} 
                      <span className="text-text/40 ml-2">({calculateAge(patient.date_of_birth)} yrs)</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ExternalLink className="w-4 h-4 text-text/30 mt-1" />
                  <div>
                    <p className="text-xs text-text/40 font-medium uppercase tracking-wider">Referral Source</p>
                    <p className="text-sm font-medium text-text">{patient.referral_source || '—'}</p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text">GDPR Consent</p>
                    <p className="text-xs text-text/40">Patient can receive messages</p>
                  </div>
                  <button 
                    onClick={toggleConsent}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      patient.gdpr_consent ? 'bg-primary' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      patient.gdpr_consent ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* 3. WHATSAPP MESSAGES STATUS (Automation Status) */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-text font-bricolage">Automation Status</h2>
              </div>
              
              {messages.length === 0 ? (
                <div className="py-8 text-center text-xs text-text/40 italic">No automated messages scheduled.</div>
              ) : (
                <div className="space-y-3">
                  {messages.map(msg => (
                    <div key={msg.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-background/30">
                      <div>
                        <p className="text-xs font-semibold text-text uppercase tracking-tight">{msg.message_type?.replace(/_/g, ' ') ?? ''}</p>
                        <p className="text-[10px] text-text/40 mt-0.5">{new Date(msg.scheduled_for).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                      </div>
                      <div>
                        {msg.status === 'sent' && <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center"><CheckCircle className="w-3.5 h-3.5 text-green-600" /></div>}
                        {msg.status === 'pending' && <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center"><Clock className="w-3.5 h-3.5 text-gray-400" /></div>}
                        {msg.status === 'failed' && <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center"><AlertCircle className="w-3.5 h-3.5 text-red-500" /></div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 2. SESSION HISTORY */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-text font-bricolage">Session History</h2>
              </div>
              
              {bookings.length === 0 ? (
                <div className="p-12 text-center text-text/40 text-sm italic">No session history found.</div>
              ) : (
                <div className="divide-y divide-border">
                  {bookings.map(booking => {
                    const isExpanded = expandedBooking === booking.id
                    const painSummary = booking.pain_data ? Object.keys(booking.pain_data).join(', ') : 'No pain data'
                    
                    return (
                      <div key={booking.id} className="bg-white">
                        <div 
                          className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-background/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedBooking(isExpanded ? null : booking.id)}
                        >
                          <div className="flex items-start gap-4">
                            <div className="mt-1">
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-text/30" /> : <ChevronDown className="w-4 h-4 text-text/30" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-text">{formatLocalTime(booking.appointment_time, country, 'EEE, MMM d, yyyy')}</p>
                              <p className="text-xs text-text/40 mt-0.5">{formatLocalTime(booking.appointment_time, country, 'h:mm a')} {getTimezoneAbbr(country, new Date(booking.appointment_time))} · {booking.appointment_type?.replace('_', ' ')?.toUpperCase() ?? ''}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-medium text-text/50 max-w-[150px] truncate hidden sm:block">{painSummary}</span>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getBookingStatusColor(booking.status)}`}>
                              {booking.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="px-5 pb-6 pt-1 border-t border-border/50 bg-background/20 animate-in slide-in-from-top-2 duration-200">
                            <div className="mt-4 space-y-4">
                              <div>
                                <h4 className="text-[10px] font-bold text-text/40 uppercase tracking-widest mb-2">SOAP Notes / Clinical Record</h4>
                                <div className="p-4 rounded-xl bg-white border border-border shadow-sm text-sm text-text/80 leading-relaxed min-h-[80px]">
                                  {booking.notes || 'No notes recorded for this session.'}
                                </div>
                              </div>
                              
                              {booking.status === 'upcoming' && (
                                <div className="flex gap-2 pt-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateBookingStatus(booking.id, 'completed') }}
                                    disabled={updatingBooking === booking.id}
                                    className="flex-1 bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                                  >
                                    Mark Complete
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateBookingStatus(booking.id, 'no_show') }}
                                    disabled={updatingBooking === booking.id}
                                    className="flex-1 bg-alert/5 border border-alert/10 text-alert hover:bg-alert/10 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                                  >
                                    Mark No-Show
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 4. DATA MANAGEMENT (GDPR) */}
            <div className="bg-card border border-alert/20 rounded-2xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldAlert className="w-24 h-24 text-alert" />
              </div>
              <div className="flex items-center gap-2 mb-6 relative z-10">
                <ShieldAlert className="w-4 h-4 text-alert" />
                <h2 className="font-bold text-text font-bricolage">Data Management (GDPR)</h2>
              </div>
              
              <div className="space-y-6 relative z-10">
                <div className="flex flex-col sm:flex-row items-center gap-4 pb-6 border-b border-border/50">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text">Right to Data Portability</p>
                    <p className="text-xs text-text/40 mt-1">Download a comprehensive ZIP file containing JSON data and PDF summaries of all notes and sessions.</p>
                  </div>
                  <button 
                    onClick={handleExport}
                    disabled={isExporting}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-border text-text text-sm font-semibold px-6 py-3 rounded-xl hover:bg-background transition-all shadow-sm active:scale-95 whitespace-nowrap disabled:opacity-50"
                  >
                    {isExporting ? <Clock className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isExporting ? 'Exporting...' : 'Export All Data'}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-alert">Right to be Forgotten</p>
                    <p className="text-xs text-text/40 mt-1">Permanently delete this patient and all associated records from the system. This cannot be undone.</p>
                  </div>
                  <button 
                    onClick={() => setShowDeleteModal(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-alert/5 border border-alert/20 text-alert text-sm font-semibold px-6 py-3 rounded-xl hover:bg-alert hover:text-white transition-all shadow-sm active:scale-95 whitespace-nowrap"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Patient
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-alert/5 border-b border-alert/10">
              <div className="flex items-center gap-3 text-alert mb-2">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold font-bricolage">Delete Patient Record</h3>
              </div>
              <p className="text-sm text-alert/80">
                You are about to permanently delete all data for <strong>{patient.full_name}</strong>.
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-background rounded-xl p-4 text-sm text-text/70 space-y-2">
                <p className="font-semibold text-text mb-3">This action will cascade delete:</p>
                <p className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-alert" /> {bookings.length} Bookings</p>
                <p className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-alert" /> All associated SOAP notes</p>
                <p className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-alert" /> {messages.length} WhatsApp message logs</p>
                <p className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-alert" /> Consent and activity records</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text/50 uppercase tracking-wider mb-2">
                  Please type <span className="text-text font-bold select-none">{patient.full_name}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={patient.full_name}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:outline-none focus:border-alert focus:ring-1 focus:ring-alert transition-all"
                />
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                className="flex-1 bg-white border border-border text-text font-bold py-3 rounded-xl hover:bg-gray-50 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== patient.full_name || isDeleting}
                className="flex-1 bg-alert text-white font-bold py-3 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? <Clock className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
