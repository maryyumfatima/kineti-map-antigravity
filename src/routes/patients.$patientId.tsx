import { createFileRoute, Link, useParams, useNavigate } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import {
  Calendar, FileText, Files, History, ChevronRight, Search, Printer, Download, Plus, Clock, Activity, ArrowUpRight, User, Phone, Mail, Sparkles, AlertTriangle, CheckCircle, Upload, MessageSquare, ChevronDown, ChevronUp, Archive, X
} from 'lucide-react'
import { formatLocalTime } from '../lib/date'
import { generatePatientInsights } from '../lib/groq'

export const Route = createFileRoute('/patients/$patientId')({
  component: PatientProfilePage,
})

type Patient = {
  id: string
  full_name: string
  phone_number: string
  email: string | null
  date_of_birth: string | null
  primary_complaint: string
  status_tag: string
  created_at: string
  clinic_id: string
  gdpr_consent: boolean
  archived?: boolean
  status?: string
  archived_at?: string | null
  archived_by?: string | null
  retention_expires_at?: string
}

type Booking = {
  id: string
  appointment_time: string
  status: string
  appointment_type: string
  pain_data: any
  treatment_summary: string
  notes: string
  session_notes?: SoapNote[]
}

type SoapNote = {
  id: string
  created_at: string
  s: string
  o: string
  a: string
  p: string
  type: string
  tags: string[]
}

type Message = {
  id: string
  created_at: string
  status: string
  inbound_text: string | null
  message_type: string
}

function PatientProfilePage() {
  const { patientId } = useParams({ strict: false }) as { patientId: string }
  const navigate = useNavigate()
  
  const [patient, setPatient] = useState<Patient | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [soapNotes, setSoapNotes] = useState<SoapNote[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  
  const [loading, setLoading] = useState(true)
  const [clinicTimezone, setClinicTimezone] = useState<string>('Europe/London')
  const [activeTab, setActiveTab] = useState<'timeline' | 'soap' | 'docs' | 'communication'>('timeline')
  
  // Stats
  const [stats, setStats] = useState({ total: 0, completed: 0, avgBefore: 0, avgAfter: 0, attendance: 0 })
  
  // AI Insights
  const [aiInsights, setAiInsights] = useState<any>(null)
  const [generatingInsights, setGeneratingInsights] = useState(false)
  
  // UI State
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({})

  const isAdmin = true // Added to enable GDPR delete button visibility

  useEffect(() => {
    fetchData()
  }, [patientId])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Fetch Patient
      const { data: pData } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()
      
      if (pData) setPatient(pData)

      // 2. Fetch Bookings with notes
      const { data: bData } = await supabase
        .from('bookings')
        .select('*, session_notes(*)')
        .eq('patient_id', patientId)
        .order('appointment_time', { ascending: false })
      
      if (bData) {
        setBookings(bData)
        calculateStats(bData)
      }

      // 3. Fetch independent SOAP Notes
      const { data: nData } = await supabase
        .from('session_notes')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
      
      if (nData) setSoapNotes(nData)

      // 4. Fetch Messages
      const { data: mData } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
      
      if (mData) setMessages(mData)

      // 5. Fetch Clinic
      if (pData?.clinic_id) {
        const { data: clinic } = await supabase.from('clinics').select('timezone').eq('id', pData.clinic_id).single()
        if (clinic) setClinicTimezone(clinic.timezone || 'Europe/London')
      }

    } catch (e) {
      console.error(e)
      toast.error('Failed to load patient profile')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (bks: Booking[]) => {
    const total = bks.length
    const completed = bks.filter(b => b.status === 'completed').length
    const attendance = total > 0 ? Math.round((completed / total) * 100) : 0

    let beforeSum = 0, afterSum = 0, count = 0
    bks.forEach(b => {
      if (b.pain_data && b.pain_data.pain_before !== undefined && b.pain_data.pain_after !== undefined) {
        beforeSum += b.pain_data.pain_before
        afterSum += b.pain_data.pain_after
        count++
      }
    })

    setStats({
      total,
      completed,
      attendance,
      avgBefore: count > 0 ? Math.round((beforeSum / count) * 10) / 10 : 0,
      avgAfter: count > 0 ? Math.round((afterSum / count) * 10) / 10 : 0
    })
  }

  const handleGenerateInsights = async () => {
    if (!patient) return
    setGeneratingInsights(true)
    try {
      const completed = bookings.filter(b => b.status === 'completed')
      const painScores = completed.map(b => b.pain_data?.pain_after || 0).reverse()
      const treatments = soapNotes.flatMap(n => n.tags || [])
      
      const insights = await generatePatientInsights({
        patientName: patient.full_name,
        complaint: patient.primary_complaint,
        totalSessions: stats.total,
        completedSessions: stats.completed,
        avgPainBefore: stats.avgBefore,
        avgPainAfter: stats.avgAfter,
        painScores,
        treatments,
        attendanceRate: stats.attendance
      })
      setAiInsights(insights)
      toast.success('Insights generated successfully')
    } catch (e) {
      console.error(e)
      toast.error('Failed to generate insights')
    } finally {
      setGeneratingInsights(false)
    }
  }

  const handleArchivePatient = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not found')
      
      const { error } = await supabase
        .from('patients')
        .update({
          status: 'archived',
          status_tag: 'archived', // Also update status_tag for UI compatibility
          archived_at: new Date().toISOString(),
          archived_by: user.id
        })
        .eq('id', patientId)

      if (error) throw error

      toast.success('Patient archived. Data retained per legal requirements.')
      navigate({ to: '/patients',  })
    } catch (error) {
      toast.error('Failed to archive patient')
      console.error(error)
    }
  }

  const handleUnarchivePatient = async () => {
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          status: 'active',
          status_tag: 'active', // Also update status_tag for UI compatibility
          archived_at: null,
          archived_by: null
        })
        .eq('id', patientId)

      if (error) throw error

      toast.success('Patient reactivated')
      setPatient({ ...patient!, status: 'active', status_tag: 'active' })
    } catch (error) {
      toast.error('Failed to reactivate patient')
    }
  }

  const handleDeletePatient = async () => {
    if (!patient) return
    try {
      // Check if retention period has expired
      if (patient.retention_expires_at) {
        const retentionDate = new Date(patient.retention_expires_at)
        const today = new Date()
        
        if (retentionDate > today) {
          toast.error(
            `Cannot delete. Legal retention required until ${retentionDate.toLocaleDateString()}`
          )
          return
        }
      }

      // Show confirmation modal
      const confirmed = await new Promise((resolve) => {
        const modal = document.createElement('div')
        modal.innerHTML = `
          <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div class="bg-white rounded-xl p-6 max-w-md">
              <h3 class="text-xl font-bold text-red-600 mb-4">⚠️ Permanent Deletion</h3>
              <p class="text-sm text-gray-600 mb-4">
                This will permanently delete all data for <strong>${patient.full_name}</strong>:
              </p>
              <ul class="text-sm text-gray-600 mb-4 list-disc list-inside">
                <li>All session records</li>
                <li>All SOAP notes</li>
                <li>All WhatsApp messages</li>
                <li>All feedback</li>
                <li>All documents</li>
              </ul>
              <p class="text-sm font-bold mb-4">
                Type the patient's full name to confirm: <span class="text-primary">${patient.full_name}</span>
              </p>
              <input type="text" id="confirm-name" class="w-full border rounded px-3 py-2 mb-4" />
              <div class="flex gap-3">
                <button id="cancel-delete" class="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded">Cancel</button>
                <button id="confirm-delete" class="flex-1 bg-red-600 text-white px-4 py-2 rounded">Delete Forever</button>
              </div>
            </div>
          </div>
        `
        document.body.appendChild(modal)

        modal.querySelector('#cancel-delete')?.addEventListener('click', () => {
          document.body.removeChild(modal)
          resolve(false)
        })

        modal.querySelector('#confirm-delete')?.addEventListener('click', () => {
          const input = modal.querySelector('#confirm-name') as HTMLInputElement
          if (input.value === patient.full_name) {
            document.body.removeChild(modal)
            resolve(true)
          } else {
            toast.error('Name does not match')
          }
        })
      })

      if (!confirmed) return

      // Execute cascade delete
      const { error } = await supabase.rpc('delete_patient_gdpr', {
        patient_uuid: patientId
      })

      if (error) throw error

      toast.success('Patient data permanently deleted')
      navigate({ to: '/patients',  })

    } catch (error) {
      toast.error('Failed to delete patient')
      console.error(error)
    }
  }

  const toggleSession = (id: string) => {
    setExpandedSessions(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-primary/10 text-primary border-primary/20'
      case 'lapsed': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'discharged': return 'bg-gray-100 text-gray-700 border-gray-200'
      case 'archived': return 'bg-gray-200 text-gray-600 border-gray-300'
      case 'completed': return 'bg-green-100 text-green-700 border-green-200'
      case 'upcoming': return 'bg-sky-100 text-sky-700 border-sky-200'
      case 'no_show': return 'bg-alert/10 text-alert border-alert/20'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-8 animate-pulse">
          <div className="h-32 bg-gray-100 rounded-2xl w-full" />
          <div className="h-48 bg-gray-100 rounded-2xl w-full" />
          <div className="h-64 bg-gray-100 rounded-2xl w-full" />
        </div>
      </DashboardLayout>
    )
  }

  if (!patient) return <DashboardLayout><div>Patient not found</div></DashboardLayout>

  return (
    <DashboardLayout fullWidth={true}>
      <div className="max-w-5xl mx-auto pb-24 font-sans slide-up">
        
        {/* Sticky Header Section */}
        <div className="sticky-patient-header pt-6 pb-4 bg-white/80 border-b border-border mb-8 px-4 -mx-4 sm:px-0 sm:mx-0 rounded-b-2xl sm:rounded-none">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl font-bricolage border border-primary/20 shadow-sm shrink-0">
                {patient.full_name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-[32px] font-bold text-text font-bricolage leading-tight tracking-tight">{patient.full_name}</h1>
                  <select 
                    className={`text-xs font-bold px-2 py-1 rounded-full outline-none cursor-pointer border ${getStatusColor(patient.status_tag)}`}
                    value={patient.status_tag}
                    onChange={async (e) => {
                      const newStatus = e.target.value
                      setPatient({ ...patient, status_tag: newStatus })
                      await supabase.from('patients').update({ status_tag: newStatus }).eq('id', patient.id)
                      toast.success('Status updated')
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="lapsed">Lapsed</option>
                    <option value="discharged">Discharged</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-text/60 mt-1.5 font-medium">
                  <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-primary" /> {patient.primary_complaint}</span>
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {patient.phone_number}</span>
                  {patient.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {patient.email}</span>}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
              <div className="flex gap-2 mr-2">
                {(patient.status === 'active' || patient.status_tag === 'active') && (
                  <button
                    onClick={handleArchivePatient}
                    className="whitespace-nowrap px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-300 transition-colors shadow-sm"
                  >
                    Archive Patient
                  </button>
                )}
                
                {(patient.status === 'archived' || patient.status_tag === 'archived') && (
                  <button
                    onClick={handleUnarchivePatient}
                    className="whitespace-nowrap px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors shadow-sm"
                  >
                    Reactivate Patient
                  </button>
                )}
                
                {isAdmin && (
                  <button
                    onClick={handleDeletePatient}
                    className="whitespace-nowrap px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm"
                  >
                    Delete (GDPR)
                  </button>
                )}
              </div>
              <button className="whitespace-nowrap px-4 py-2 bg-white border border-border rounded-xl text-sm font-semibold hover:bg-gray-50 flex items-center gap-2 shadow-sm transition-all">
                <Calendar className="w-4 h-4" /> Book Session
              </button>
              <button className="whitespace-nowrap px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm font-semibold hover:bg-green-100 flex items-center gap-2 shadow-sm transition-all">
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-0">
          {/* Stats Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 slide-up-delay-1">
            <div className="bg-white border border-border p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-primary opacity-70" />
                <span className="text-xs font-bold text-text/50 uppercase tracking-wider">Sessions</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-text font-bricolage">{stats.total}</span>
                <span className="text-xs font-medium text-text/50">{stats.completed} done</span>
              </div>
            </div>
            
            <div className="bg-white border border-border p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-accent opacity-70" />
                <span className="text-xs font-bold text-text/50 uppercase tracking-wider">Avg Pain (Before)</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-text font-bricolage">{stats.avgBefore}</span>
                <span className="text-xs font-medium text-text/50">/ 10</span>
              </div>
            </div>

            <div className="bg-white border border-border p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-green-600 opacity-70" />
                <span className="text-xs font-bold text-text/50 uppercase tracking-wider">Avg Pain (After)</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-text font-bricolage">{stats.avgAfter}</span>
                <span className="text-xs font-medium text-green-600 flex items-center">
                  <ChevronDown className="w-3 h-3" /> {Math.abs(stats.avgBefore - stats.avgAfter).toFixed(1)}
                </span>
              </div>
            </div>

            <div className="bg-white border border-border p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-600 opacity-70" />
                <span className="text-xs font-bold text-text/50 uppercase tracking-wider">Attendance</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-text font-bricolage">{stats.attendance}%</span>
              </div>
            </div>
          </div>

          {/* AI Insights Panel */}
          <div className="mb-10 slide-up-delay-2">
            <div className="ai-gradient-bg p-[1px] rounded-3xl shadow-lg pulse-glow">
              <div className="bg-white/95 backdrop-blur-xl rounded-[23px] p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-text font-bricolage">Clinical AI Insights</h2>
                      <p className="text-sm text-text/60">Automated analysis of session history and pain trends.</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleGenerateInsights}
                    disabled={generatingInsights}
                    className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {generatingInsights ? <Clock className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {aiInsights ? 'Refresh Analysis' : 'Generate Report'}
                  </button>
                </div>

                {aiInsights ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-500">
                    <div className="md:col-span-2 space-y-4">
                      <div>
                        <h3 className="text-xs font-bold text-text/50 uppercase tracking-wider mb-2">Progress Summary</h3>
                        <p className="text-sm text-text/80 leading-relaxed font-medium bg-gray-50/50 p-4 rounded-xl border border-gray-100">{aiInsights.progressSummary}</p>
                      </div>
                      
                      {aiInsights.riskFlags?.length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-alert uppercase tracking-wider mb-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Risk Flags</h3>
                          <ul className="space-y-2">
                            {aiInsights.riskFlags.map((flag: string, i: number) => (
                              <li key={i} className="text-sm text-alert/90 bg-alert/5 p-3 rounded-xl border border-alert/10 flex items-start gap-2">
                                <span className="mt-0.5">•</span> {flag}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="text-xs font-bold text-text/50 uppercase tracking-wider mb-2">Recommended Next Steps</h3>
                      <ul className="space-y-3">
                        {aiInsights.recommendations?.map((rec: string, i: number) => (
                          <li key={i} className="text-sm text-text/80 bg-primary/5 p-3 rounded-xl border border-primary/10 flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" /> <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <div className="mt-4 p-4 rounded-xl border border-border flex items-center justify-between">
                        <span className="text-xs font-bold text-text/50 uppercase tracking-wider">Overall Trend</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                          aiInsights.trend === 'improving' ? 'bg-green-100 text-green-700' : 
                          aiInsights.trend === 'declining' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {aiInsights.trend || 'Stable'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center bg-gray-50/50 rounded-xl border border-border border-dashed">
                    <p className="text-text/40 text-sm font-medium">Click Generate Report to analyze {stats.total} sessions using AI.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabbed Content Area */}
          <div className="slide-up-delay-3">
            <div className="flex items-center gap-2 border-b border-border overflow-x-auto hide-scrollbar pb-px">
              {[
                { id: 'timeline', label: 'Timeline', icon: History },
                { id: 'soap', label: 'SOAP Notes', icon: FileText },
                { id: 'docs', label: 'Documents', icon: Files },
                { id: 'communication', label: 'Communication', icon: MessageSquare }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                    activeTab === tab.id 
                      ? 'border-primary text-primary bg-primary/5' 
                      : 'border-transparent text-text/50 hover:text-text hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-primary' : 'text-text/40'}`} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="py-8">
              {/* TIMELINE TAB */}
              {activeTab === 'timeline' && (
                <div className="space-y-6 tab-content-enter">
                  {bookings.length === 0 ? (
                    <div className="text-center py-12 text-text/40">No sessions recorded.</div>
                  ) : (
                    bookings.map((booking, i) => {
                      const isExpanded = expandedSessions[booking.id]
                      const painDiff = (booking.pain_data?.pain_before ?? 0) - (booking.pain_data?.pain_after ?? 0)
                      
                      return (
                        <div key={booking.id} className="relative pl-8 pb-4 group">
                          {i !== bookings.length - 1 && (
                            <div className="absolute left-[11px] top-8 bottom-[-16px] w-0.5 bg-border group-hover:bg-primary/30 transition-colors" />
                          )}
                          <div className="absolute left-0 top-6 w-6 h-6 rounded-full border-[3px] border-background bg-border flex items-center justify-center group-hover:bg-primary transition-colors">
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>

                          <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <div 
                              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50"
                              onClick={() => toggleSession(booking.id)}
                            >
                              <div>
                                <div className="flex items-center gap-3 mb-1">
                                  <span className="font-bold text-text">{formatLocalTime(booking.appointment_time, country, 'MMM d, yyyy')}</span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(booking.status)}`}>
                                    {booking.status}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 text-[10px] font-bold uppercase tracking-wider">
                                    {booking.appointment_type.replace('_', ' ')}
                                  </span>
                                </div>
                                <span className="text-sm font-medium text-text/50">{formatLocalTime(booking.appointment_time, country, 'h:mm a', clinicTimezone)}</span>
                              </div>

                              {booking.pain_data && (
                                <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                  <span className="text-xs font-bold text-text/40">PAIN:</span>
                                  <div className="flex items-center gap-2 font-bricolage font-bold">
                                    <span className="text-text/60">{booking.pain_data.pain_before}</span>
                                    <ArrowUpRight className={`w-3.5 h-3.5 ${painDiff > 0 ? 'text-green-500 rotate-90' : painDiff < 0 ? 'text-red-500 -rotate-90' : 'text-gray-300 rotate-45'}`} />
                                    <span className={painDiff > 0 ? 'text-green-600' : 'text-text'}>{booking.pain_data.pain_after}</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className={`expand-section ${isExpanded ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                              <div className="p-5 pt-0 border-t border-border bg-gray-50/30">
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                    <h4 className="text-[10px] font-bold text-text/40 uppercase tracking-widest mb-2">Session Notes</h4>
                                    <p className="text-sm text-text/80 whitespace-pre-wrap">{booking.notes || 'No notes available.'}</p>
                                  </div>
                                  <div>
                                    <h4 className="text-[10px] font-bold text-text/40 uppercase tracking-widest mb-2">Treatments Applied</h4>
                                    <p className="text-sm text-text/80">{booking.treatment_summary || 'None recorded.'}</p>
                                  </div>
                                </div>
                                {booking.session_notes && booking.session_notes.length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-border/50">
                                    <h4 className="text-[10px] font-bold text-text/40 uppercase tracking-widest mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI SOAP Note Attached</h4>
                                    <button onClick={() => setActiveTab('soap')} className="text-sm text-primary font-bold hover:underline">View in SOAP Notes tab →</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* SOAP NOTES TAB */}
              {activeTab === 'soap' && (
                <div className="space-y-6 tab-content-enter">
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/30" />
                      <input type="text" placeholder="Search notes..." className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-sm outline-none focus:border-primary" />
                    </div>
                    <Link to="/ai/soap-notes"  className="btn-premium bg-primary text-white text-sm flex items-center gap-2">
                      <Plus className="w-4 h-4" /> New Note
                    </Link>
                  </div>

                  {soapNotes.length === 0 ? (
                    <div className="text-center py-12 text-text/40">No SOAP notes found.</div>
                  ) : (
                    <div className="grid gap-6">
                      {soapNotes.map(note => (
                        <div key={note.id} className="bg-white border border-border rounded-2xl p-5 shadow-sm">
                          <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                            <span className="font-bold text-text">{formatLocalTime(note.created_at, country, 'MMM d, yyyy')}</span>
                            <div className="flex gap-2">
                              <button className="p-1.5 text-text/40 hover:text-primary rounded"><Printer className="w-4 h-4" /></button>
                              <button className="p-1.5 text-text/40 hover:text-primary rounded"><Download className="w-4 h-4" /></button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><h4 className="text-[10px] font-bold text-text/30 uppercase tracking-widest mb-1">Subjective</h4><p className="text-sm text-text/80">{note.s}</p></div>
                            <div><h4 className="text-[10px] font-bold text-text/30 uppercase tracking-widest mb-1">Objective</h4><p className="text-sm text-text/80">{note.o}</p></div>
                            <div><h4 className="text-[10px] font-bold text-text/30 uppercase tracking-widest mb-1">Assessment</h4><p className="text-sm text-text/80">{note.a}</p></div>
                            <div><h4 className="text-[10px] font-bold text-text/30 uppercase tracking-widest mb-1">Plan</h4><p className="text-sm text-text/80">{note.p}</p></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* DOCUMENTS TAB */}
              {activeTab === 'docs' && (
                <div className="tab-content-enter text-center py-20 border-2 border-dashed border-border rounded-2xl bg-gray-50/50">
                  <Files className="w-12 h-12 text-text/20 mx-auto mb-4" />
                  <h3 className="font-bold text-text mb-1">No documents yet</h3>
                  <p className="text-sm text-text/50 mb-6">Upload consent forms, scan results, or exercise sheets.</p>
                  <button className="px-5 py-2.5 bg-white border border-border rounded-xl text-sm font-semibold hover:bg-gray-50 inline-flex items-center gap-2 shadow-sm">
                    <Upload className="w-4 h-4" /> Upload Document
                  </button>
                </div>
              )}

              {/* COMMUNICATION TAB */}
              {activeTab === 'communication' && (
                <div className="tab-content-enter space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12 text-text/40">No message history.</div>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} className="bg-white border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-bold text-sm text-text capitalize">{msg.message_type.replace('_', ' ')}</p>
                          <p className="text-xs text-text/50 mt-1">{formatLocalTime(msg.created_at, country, 'PPp', clinicTimezone)}</p>
                          {msg.inbound_text && <p className="text-sm text-text/70 mt-2 bg-gray-50 p-2 rounded-lg italic">"{msg.inbound_text}"</p>}
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                          msg.status === 'delivered' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                          msg.status === 'read' ? 'bg-green-50 text-green-600 border-green-200' :
                          'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                          {msg.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Admin Archive Section Removed (Moved to header) */}

        </div>
      </div>

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-text font-bricolage flex items-center gap-2"><Archive className="w-5 h-5 text-alert" /> Archive Patient</h3>
              <button onClick={() => setShowArchiveModal(false)}><X className="w-5 h-5 text-text/40" /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-text/70 mb-4">Are you sure you want to archive <strong>{patient.full_name}</strong>? They will be removed from active lists but their data will be retained for legal compliance.</p>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs text-text/60 font-medium">
                Data retention policy: Records are kept for 7 years from the last session date.
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => setShowArchiveModal(false)} className="flex-1 px-4 py-2 bg-white border border-border rounded-xl font-bold text-text">Cancel</button>
              <button onClick={handleArchive} disabled={isArchiving} className="flex-1 px-4 py-2 bg-alert text-white rounded-xl font-bold flex items-center justify-center gap-2">
                {isArchiving ? 'Archiving...' : 'Confirm Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  )
}
