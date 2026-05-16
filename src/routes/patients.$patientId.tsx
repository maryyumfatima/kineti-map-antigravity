import { createFileRoute, Link, useParams, useNavigate } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import {
  Calendar, FileText, History, ChevronRight, Search, Printer, Download, Plus, Clock, Activity, User, Phone, Mail, Sparkles, CheckCircle, MessageSquare, Archive, X, MapPin, Briefcase, Stethoscope, ShieldCheck, CreditCard, Trash2, LogOut, Settings, Lock, Share2
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
  occupation?: string | null
  address?: string | null
  gp_practice?: string | null
  marketing_opt_in?: boolean
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  is_minor?: boolean
  guardian_name?: string | null
  guardian_whatsapp?: string | null
  referral_source?: string | null
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
  is_ai_generated?: boolean
  subjective?: string
  objective?: string
  assessment?: string
  plan?: string
}

type Message = {
  id: string
  created_at: string
  status: string
  inbound_text: string | null
  message_type: string
}

type Payment = {
  id: string
  amount: number
  currency: string
  payment_status: string
  recorded_at: string
  notes: string | null
  recorded_by: string | null
}

function PatientProfilePage() {
  const { patientId } = useParams({ strict: false }) as { patientId: string }
  const navigate = useNavigate()
  const country = 'GB'
  
  const [patient, setPatient] = useState<Patient | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [soapNotes, setSoapNotes] = useState<SoapNote[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  
  const [loading, setLoading] = useState(true)
  const [clinicTimezone, setClinicTimezone] = useState<string>('Europe/London')
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'clinical' | 'communication' | 'payments' | 'admin'>('overview')
  
  // Stats
  const [stats, setStats] = useState({ total: 0, completed: 0, avgBefore: 0, avgAfter: 0, attendance: 0, lastVisit: '', nextVisit: '' })
  
  // AI Insights
  const [aiInsights, setAiInsights] = useState<any>(null)
  const [generatingInsights, setGeneratingInsights] = useState(false)
  
  // UI State
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Patient>>({})

  const isAdmin = true 

  const handleUpdatePatient = async () => {
    try {
      const { error } = await supabase
        .from('patients')
        .update(editForm)
        .eq('id', patientId)
      
      if (error) throw error
      
      setPatient(prev => prev ? { ...prev, ...editForm } : null)
      setIsEditing(false)
      toast.success('Profile updated successfully')
    } catch (e) {
      console.error(e)
      toast.error('Failed to update profile')
    }
  }

  const startEditing = () => {
    if (patient) {
      setEditForm({
        full_name: patient.full_name,
        occupation: patient.occupation,
        address: patient.address,
        gp_practice: patient.gp_practice,
        phone_number: patient.phone_number,
        email: patient.email,
        primary_complaint: patient.primary_complaint,
        emergency_contact_name: patient.emergency_contact_name,
        emergency_contact_phone: patient.emergency_contact_phone,
        marketing_opt_in: patient.marketing_opt_in,
        gdpr_consent: patient.gdpr_consent
      })
      setIsEditing(true)
      setActiveTab('details')
    }
  }

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

      // 5. Fetch Payments
      const { data: payData } = await supabase
        .from('cash_ledger')
        .select('*')
        .eq('patient_id', patientId)
        .order('recorded_at', { ascending: false })
      
      if (payData) setPayments(payData)

      // 6. Fetch Clinic
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

    // Last & Next Visit
    const now = new Date()
    const pastBookings = bks.filter(b => new Date(b.appointment_time) < now && b.status !== 'cancelled')
    const futureBookings = bks.filter(b => new Date(b.appointment_time) >= now && b.status !== 'cancelled')
    
    const lastVisit = pastBookings.length > 0 ? pastBookings[0].appointment_time : ''
    const nextVisit = futureBookings.length > 0 ? futureBookings[futureBookings.length - 1].appointment_time : ''

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
      lastVisit,
      nextVisit,
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

  const handleDischarge = async () => {
    try {
      const { error } = await supabase
        .from('patients')
        .update({ status_tag: 'discharged' })
        .eq('id', patientId)
      if (error) throw error
      setPatient(prev => prev ? { ...prev, status_tag: 'discharged' } : null)
      toast.success('Patient discharged')
    } catch (e) {
      toast.error('Failed to discharge patient')
    }
  }

  const handleArchivePatient = async () => {
    setIsArchiving(true)
    try {
      const { error } = await supabase
        .from('patients')
        .update({ status_tag: 'archived' })
        .eq('id', patientId)
      
      if (error) throw error
      
      setPatient(prev => prev ? { ...prev, status_tag: 'archived' } : null)
      toast.success('Patient archived successfully')
      setShowArchiveModal(false)
    } catch (e) {
      console.error(e)
      toast.error('Failed to archive patient')
    } finally {
      setIsArchiving(false)
    }
  }

  const handleDeletePatient = async () => {
    if (!window.confirm('CRITICAL ACTION: This will permanently delete all patient records, medical notes, and financial history to comply with GDPR Right to Erasure. This cannot be undone. Proceed?')) {
      return
    }

    try {
      // 1. Delete dependent data first (cascading normally handled by DB, but being explicit for security)
      // The DB schema should have ON DELETE CASCADE, but we'll trigger the main delete
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', patientId)
      
      if (error) throw error
      
      toast.success('Patient and all associated records deleted (GDPR compliant)')
      navigate({ to: '/patients' })
    } catch (e) {
      console.error(e)
      toast.error('Failed to delete patient. Ensure you have admin privileges.')
    }
  }

  const handleExportData = () => {
    const data = {
      patient,
      bookings,
      soapNotes,
      messages,
      payments
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `patient_data_${patient?.full_name.replace(' ', '_')}.json`
    a.click()
    toast.success('Data export started')
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-700 border-green-200'
      case 'lapsed': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'discharged': return 'bg-gray-100 text-gray-700 border-gray-200'
      case 'archived': return 'bg-gray-200 text-gray-600 border-gray-300'
      case 'new': return 'bg-blue-100 text-blue-700 border-blue-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-8 animate-pulse">
          <div className="h-32 bg-gray-100 rounded-2xl w-full" />
          <div className="h-10 bg-gray-100 rounded-lg w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            <div className="h-24 bg-gray-100 rounded-xl" />
            <div className="h-24 bg-gray-100 rounded-xl" />
            <div className="h-24 bg-gray-100 rounded-xl" />
            <div className="h-24 bg-gray-100 rounded-xl" />
          </div>
          <div className="h-64 bg-gray-100 rounded-2xl w-full" />
        </div>
      </DashboardLayout>
    )
  }

  if (!patient) return <DashboardLayout><div>Patient not found</div></DashboardLayout>

  return (
    <DashboardLayout fullWidth={true}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans slide-up">
        
        {/* --- HEADER CARD --- */}
        <div className="bg-white rounded-[32px] border border-border p-6 sm:p-8 mb-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center relative z-10">
            {/* Avatar & Basic Info */}
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-primary/10 flex items-center justify-center text-primary font-bold text-4xl font-bricolage border-2 border-primary/20 shadow-inner shrink-0 overflow-hidden">
                {patient.full_name.charAt(0)}
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl sm:text-4xl font-bold text-text font-bricolage tracking-tight">{patient.full_name}</h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getStatusColor(patient.status_tag)}`}>
                    {patient.status_tag}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text/50 font-medium">
                  <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 opacity-70" /> Patient since {formatLocalTime(patient.created_at, country, 'MMM yyyy')}</span>
                  <span className="hidden sm:inline opacity-30">•</span>
                  <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 opacity-70" /> {patient.phone_number}</span>
                  {patient.email && (
                    <>
                      <span className="hidden sm:inline opacity-30">•</span>
                      <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 opacity-70" /> {patient.email}</span>
                    </>
                  )}
                </div>
                
                {/* Header Stats Bar */}
                <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-border/50">
                   <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-text/30 tracking-widest">Total Sessions</span>
                      <span className="text-sm font-bold text-text">{stats.total}</span>
                   </div>
                   <div className="w-px h-8 bg-border hidden sm:block" />
                   <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-text/30 tracking-widest">Last Visit</span>
                      <span className="text-sm font-bold text-text">{stats.lastVisit ? formatLocalTime(stats.lastVisit, country, 'MMM d, yyyy') : 'Never'}</span>
                   </div>
                   <div className="w-px h-8 bg-border hidden sm:block" />
                   <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-text/30 tracking-widest">Next Visit</span>
                      <span className="text-sm font-bold text-primary">{stats.nextVisit ? formatLocalTime(stats.nextVisit, country, 'MMM d, yyyy') : 'No booking'}</span>
                   </div>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="lg:ml-auto flex flex-wrap gap-2 sm:gap-3 w-full lg:w-auto">
              <button 
                onClick={startEditing}
                className="flex-1 lg:flex-none px-4 py-2.5 bg-white border border-border rounded-xl text-sm font-bold text-text hover:bg-gray-50 flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <Settings className="w-4 h-4" /> Edit Profile
              </button>
              <button onClick={handleDischarge} className="flex-1 lg:flex-none px-4 py-2.5 bg-white border border-border rounded-xl text-sm font-bold text-text hover:bg-gray-50 flex items-center justify-center gap-2 transition-all shadow-sm">
                <LogOut className="w-4 h-4 text-amber-500" /> Discharge
              </button>
              <button onClick={handleExportData} className="flex-1 lg:flex-none px-4 py-2.5 bg-white border border-border rounded-xl text-sm font-bold text-text hover:bg-gray-50 flex items-center justify-center gap-2 transition-all shadow-sm">
                <Share2 className="w-4 h-4 text-blue-500" /> Export Data
              </button>
              {isAdmin && (
                <button onClick={handleDeletePatient} className="flex-1 lg:flex-none px-4 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-bold hover:bg-red-100 flex items-center justify-center gap-2 transition-all shadow-sm">
                  <Trash2 className="w-4 h-4" /> Delete (GDPR)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* --- NAVIGATION TABS --- */}
        <div className="flex items-center gap-2 sm:gap-6 mb-8 border-b border-border overflow-x-auto hide-scrollbar">
          {[
            { id: 'overview', label: 'Overview', icon: Sparkles },
            { id: 'details', label: 'Patient Details', icon: User },
            { id: 'clinical', label: 'Clinical Notes', icon: Stethoscope },
            { id: 'communication', label: 'Communications', icon: MessageSquare },
            { id: 'payments', label: 'Payments', icon: CreditCard },
            { id: 'admin', label: 'Admin', icon: Lock }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any)
                if (tab.id !== 'details') setIsEditing(false)
              }}
              className={`flex items-center gap-2 px-1 pb-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-text/40 hover:text-text/70'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-primary' : 'text-text/30'}`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* --- TAB CONTENT --- */}
        <div className="min-h-[500px]">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
              <div className="lg:col-span-2 space-y-8">
                {/* AI Insights Card */}
                <div className="ai-gradient-bg p-[1px] rounded-[32px] shadow-lg">
                  <div className="bg-white/95 backdrop-blur-xl rounded-[31px] p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-primary" />
                        <h2 className="text-xl font-bold text-text font-bricolage">Clinical Insights</h2>
                      </div>
                      <button 
                        onClick={handleGenerateInsights}
                        disabled={generatingInsights}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5"
                      >
                        {generatingInsights ? <Clock className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                        {aiInsights ? 'Refresh Analysis' : 'Generate Analysis'}
                      </button>
                    </div>

                    {aiInsights ? (
                      <div className="space-y-6">
                        <div className="p-5 bg-primary/5 rounded-2xl border border-primary/10">
                          <p className="text-sm text-text/80 leading-relaxed font-medium italic">"{aiInsights.progressSummary}"</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div className="p-4 bg-white border border-border rounded-2xl">
                              <h3 className="text-[10px] font-bold text-text/30 uppercase tracking-widest mb-3">Pain Trend</h3>
                              <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${aiInsights.trend === 'improving' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{aiInsights.trend}</span>
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                   <div className={`h-full rounded-full ${aiInsights.trend === 'improving' ? 'bg-green-500' : 'bg-primary'}`} style={{ width: '70%' }}></div>
                                </div>
                              </div>
                           </div>
                           <div className="p-4 bg-white border border-border rounded-2xl">
                              <h3 className="text-[10px] font-bold text-text/30 uppercase tracking-widest mb-3">Next Step Recommendation</h3>
                              <p className="text-xs font-bold text-text">{aiInsights.recommendations?.[0] || 'Continue current plan'}</p>
                           </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center border-2 border-dashed border-border rounded-2xl">
                        <p className="text-sm text-text/30 font-bold mb-4">No AI summary generated for this session history.</p>
                        <button onClick={handleGenerateInsights} className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-md">Run AI Audit</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Activity Timeline */}
                <div className="space-y-4">
                   <h2 className="text-lg font-bold text-text font-bricolage px-2">Recent Sessions</h2>
                   <div className="space-y-3">
                      {bookings.slice(0, 3).map(booking => (
                        <div key={booking.id} className="bg-white border border-border rounded-2xl p-5 hover:border-primary/30 transition-all group shadow-sm">
                           <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-border group-hover:bg-primary/5 transition-colors">
                                    <Calendar className="w-5 h-5 text-text/40 group-hover:text-primary transition-colors" />
                                 </div>
                                 <div>
                                    <p className="text-sm font-bold text-text">{formatLocalTime(booking.appointment_time, country, 'eeee, MMMM d')}</p>
                                    <p className="text-xs text-text/40 font-medium">{booking.appointment_type.replace('_', ' ')} • {booking.status}</p>
                                 </div>
                              </div>
                              {booking.pain_data && (
                                <div className="text-right">
                                   <p className="text-[10px] font-bold text-text/30 uppercase tracking-widest">Pain Improvement</p>
                                   <p className="text-sm font-bold text-green-600">-{Math.max(0, (booking.pain_data.pain_before || 0) - (booking.pain_data.pain_after || 0))} pts</p>
                                </div>
                              )}
                           </div>
                        </div>
                      ))}
                      <button onClick={() => setActiveTab('clinical')} className="w-full py-3 text-xs font-bold text-text/40 hover:text-primary transition-colors">View all {stats.total} sessions →</button>
                   </div>
                </div>
              </div>

              {/* Sidebar Cards */}
              <div className="space-y-6">
                {/* Stats Summary Card */}
                <div className="bg-white border border-border rounded-[32px] p-6 shadow-sm">
                   <h3 className="text-sm font-bold text-text/30 uppercase tracking-widest mb-6">Quick Stats</h3>
                   <div className="space-y-6">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600"><History className="w-4 h-4" /></div>
                            <span className="text-sm font-bold text-text/60">Attendance</span>
                         </div>
                         <span className="text-lg font-bold text-text font-bricolage">{stats.attendance}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><Activity className="w-4 h-4" /></div>
                            <span className="text-sm font-bold text-text/60">Pain Reduction</span>
                         </div>
                         <span className="text-lg font-bold text-text font-bricolage">{(stats.avgBefore - stats.avgAfter).toFixed(1)} <span className="text-xs text-text/30 font-medium">avg</span></span>
                      </div>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600"><CreditCard className="w-4 h-4" /></div>
                            <span className="text-sm font-bold text-text/60">Lifetime Value</span>
                         </div>
                         <span className="text-lg font-bold text-text font-bricolage">£{payments.reduce((acc, p) => acc + (p.amount || 0), 0)}</span>
                      </div>
                   </div>
                </div>

                {/* Tags/Badges Card */}
                <div className="bg-white border border-border rounded-[32px] p-6 shadow-sm">
                   <h3 className="text-sm font-bold text-text/30 uppercase tracking-widest mb-4">Referral Source</h3>
                   <div className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-text/70 flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-primary" /> {patient.referral_source || 'Direct / Walk-in'}
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* DETAILS TAB */}
          {activeTab === 'details' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-text font-bricolage flex items-center gap-3">
                   <User className="w-6 h-6 text-primary" /> 
                   {isEditing ? 'Edit Patient Profile' : 'Patient Information'}
                </h2>
                <div className="flex gap-3">
                   {isEditing ? (
                     <>
                        <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-white border border-border rounded-xl text-xs font-bold text-text/50 hover:bg-gray-50 transition-all">Cancel</button>
                        <button onClick={handleUpdatePatient} className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-md hover:bg-primary/90 transition-all">Save Changes</button>
                     </>
                   ) : (
                     <button onClick={startEditing} className="px-4 py-2 bg-white border border-border rounded-xl text-xs font-bold text-primary hover:bg-primary/5 transition-all">Enable Editing</button>
                   )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-8">
                  {/* Personal Information */}
                  <div className="bg-white border border-border rounded-[32px] p-8 shadow-sm">
                    <h3 className="text-sm font-bold text-text/30 uppercase tracking-widest mb-6">Personal & Contact</h3>
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="text-[10px] font-bold text-text/30 uppercase tracking-widest block mb-1.5 ml-1">Full Name</label>
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editForm.full_name || ''} 
                            onChange={e => setEditForm({...editForm, full_name: e.target.value})}
                            className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          />
                        ) : (
                          <div className="text-sm font-bold text-text bg-gray-50/50 p-3 rounded-xl border border-gray-100/50">{patient.full_name}</div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-text/30 uppercase tracking-widest block mb-1.5 ml-1">Occupation</label>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={editForm.occupation || ''} 
                              onChange={e => setEditForm({...editForm, occupation: e.target.value})}
                              placeholder="e.g. Accountant"
                              className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            />
                          ) : (
                            <div className="flex items-center gap-2 text-sm font-bold text-text bg-gray-50/50 p-3 rounded-xl border border-gray-100/50">
                              <Briefcase className="w-4 h-4 text-text/20" /> {patient.occupation || 'Not provided'}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text/30 uppercase tracking-widest block mb-1.5 ml-1">Phone</label>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={editForm.phone_number || ''} 
                              onChange={e => setEditForm({...editForm, phone_number: e.target.value})}
                              className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            />
                          ) : (
                            <div className="text-sm font-bold text-text bg-gray-50/50 p-3 rounded-xl border border-gray-100/50">{patient.phone_number}</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text/30 uppercase tracking-widest block mb-1.5 ml-1">Home Address</label>
                        {isEditing ? (
                          <textarea 
                            rows={2}
                            value={editForm.address || ''} 
                            onChange={e => setEditForm({...editForm, address: e.target.value})}
                            placeholder="Full home address..."
                            className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                          />
                        ) : (
                          <div className="flex items-start gap-2 text-sm font-bold text-text bg-gray-50/50 p-3 rounded-xl border border-gray-100/50 min-h-[60px]">
                            <MapPin className="w-4 h-4 text-text/20 mt-0.5" /> {patient.address || 'Not provided'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Clinical Context */}
                  <div className="bg-white border border-border rounded-[32px] p-8 shadow-sm">
                    <h3 className="text-sm font-bold text-text/30 uppercase tracking-widest mb-6">Healthcare & Complaint</h3>
                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-bold text-text/30 uppercase tracking-widest block mb-1.5 ml-1">GP Practice</label>
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editForm.gp_practice || ''} 
                            onChange={e => setEditForm({...editForm, gp_practice: e.target.value})}
                            placeholder="Practice name or GP name"
                            className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          />
                        ) : (
                          <div className="flex items-center gap-2 text-sm font-bold text-text bg-gray-50/50 p-3 rounded-xl border border-gray-100/50">
                            <Stethoscope className="w-4 h-4 text-text/20" /> {patient.gp_practice || 'Not specified'}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text/30 uppercase tracking-widest block mb-1.5 ml-1">Primary Complaint</label>
                        {isEditing ? (
                          <textarea 
                            rows={3}
                            value={editForm.primary_complaint || ''} 
                            onChange={e => setEditForm({...editForm, primary_complaint: e.target.value})}
                            className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                          />
                        ) : (
                          <div className="p-4 bg-red-50/30 text-red-900 border border-red-100/50 rounded-xl text-sm font-bold leading-relaxed">
                            {patient.primary_complaint}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Emergency Contact */}
                  <div className="bg-white border border-border rounded-[32px] p-8 shadow-sm">
                    <h3 className="text-sm font-bold text-text/30 uppercase tracking-widest mb-6">Emergency Contact</h3>
                    <div className="space-y-4">
                      {isEditing ? (
                        <div className="grid grid-cols-1 gap-4">
                           <input 
                            type="text" 
                            value={editForm.emergency_contact_name || ''} 
                            onChange={e => setEditForm({...editForm, emergency_contact_name: e.target.value})}
                            placeholder="Contact Name"
                            className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          />
                          <input 
                            type="text" 
                            value={editForm.emergency_contact_phone || ''} 
                            onChange={e => setEditForm({...editForm, emergency_contact_phone: e.target.value})}
                            placeholder="Contact Phone"
                            className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                          <div>
                            <p className="text-[10px] font-bold text-text/30 uppercase tracking-widest">Contact Name</p>
                            <p className="text-sm font-bold text-text">{patient.emergency_contact_name || 'Not provided'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-text/30 uppercase tracking-widest">Phone Number</p>
                            <p className="text-sm font-bold text-text">{patient.emergency_contact_phone || 'Not provided'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* GDPR & Consents */}
                  <div className="bg-white border border-border rounded-[32px] p-8 shadow-sm">
                    <h3 className="text-sm font-bold text-text/30 uppercase tracking-widest mb-6">GDPR & Marketing</h3>
                    <div className="space-y-4">
                       <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-white group">
                          <div className="flex items-center gap-3">
                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${patient.gdpr_consent ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                                <ShieldCheck className="w-4 h-4" />
                             </div>
                             <div>
                                <p className="text-sm font-bold text-text">Data Processing Consent</p>
                                <p className="text-[10px] text-text/30 font-bold uppercase tracking-widest">Accepted on {formatLocalTime(patient.created_at, country, 'MMM d, yyyy')}</p>
                             </div>
                          </div>
                          <button 
                            onClick={() => isEditing && setEditForm({...editForm, gdpr_consent: !editForm.gdpr_consent})}
                            className={`w-12 h-6 rounded-full relative transition-colors ${(isEditing ? editForm.gdpr_consent : patient.gdpr_consent) ? 'bg-green-500' : 'bg-gray-200'} ${!isEditing && 'cursor-default'}`}
                          >
                             <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${(isEditing ? editForm.gdpr_consent : patient.gdpr_consent) ? 'left-7' : 'left-1'}`} />
                          </button>
                       </div>
                       
                       <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-white group">
                          <div className="flex items-center gap-3">
                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${patient.marketing_opt_in ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                                <Mail className="w-4 h-4" />
                             </div>
                             <div>
                                <p className="text-sm font-bold text-text">Marketing Communications</p>
                                <p className="text-[10px] text-text/30 font-bold uppercase tracking-widest">{patient.marketing_opt_in ? 'OPTED IN' : 'OPTED OUT'}</p>
                             </div>
                          </div>
                          <button 
                            onClick={() => isEditing && setEditForm({...editForm, marketing_opt_in: !editForm.marketing_opt_in})}
                            className={`w-12 h-6 rounded-full relative transition-colors ${ (isEditing ? editForm.marketing_opt_in : patient.marketing_opt_in) ? 'bg-blue-500' : 'bg-gray-200'} ${!isEditing && 'cursor-default'}`}
                          >
                             <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${(isEditing ? editForm.marketing_opt_in : patient.marketing_opt_in) ? 'left-7' : 'left-1'}`} />
                          </button>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CLINICAL TAB (SOAP + TIMELINE) */}
          {activeTab === 'clinical' && (
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
                {/* Left: Notes Stream */}
                <div className="lg:col-span-8 space-y-6">
                   <div className="flex items-center justify-between mb-2">
                      <h2 className="text-xl font-bold text-text font-bricolage">Clinical History</h2>
                      <div className="flex gap-2">
                        <button className="px-3 py-1.5 bg-white border border-border rounded-lg text-xs font-bold flex items-center gap-1.5"><Search className="w-3 h-3" /> Search</button>
                        <Link to="/ai/soap-notes" className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold flex items-center gap-1.5"><Plus className="w-3 h-3" /> Add Note</Link>
                      </div>
                   </div>

                   {soapNotes.length === 0 ? (
                      <div className="py-20 text-center bg-gray-50 rounded-[32px] border-2 border-dashed border-border">
                         <p className="text-text/30 font-bold">No SOAP notes yet.</p>
                      </div>
                   ) : (
                      <div className="space-y-6">
                         {soapNotes.map(note => (
                           <div key={note.id} className="bg-white border border-border rounded-[32px] overflow-hidden shadow-sm">
                              <div className="p-6 border-b border-border bg-gray-50/50 flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center text-primary"><FileText className="w-5 h-5" /></div>
                                    <div>
                                       <p className="text-sm font-bold text-text">{formatLocalTime(note.created_at, country, 'PPP')}</p>
                                       {note.is_ai_generated && <span className="text-[9px] font-bold text-primary uppercase tracking-wider flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Assisted</span>}
                                    </div>
                                 </div>
                                 <div className="flex gap-2">
                                    <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-border transition-all"><Printer className="w-4 h-4 text-text/30" /></button>
                                    <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-border transition-all"><Download className="w-4 h-4 text-text/30" /></button>
                                 </div>
                              </div>
                              <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
                                 <div>
                                    <h4 className="text-[10px] font-bold text-text/30 uppercase tracking-widest mb-3">Subjective</h4>
                                    <p className="text-sm text-text/70 leading-relaxed">{note.subjective || note.s}</p>
                                 </div>
                                 <div>
                                    <h4 className="text-[10px] font-bold text-text/30 uppercase tracking-widest mb-3">Objective</h4>
                                    <p className="text-sm text-text/70 leading-relaxed">{note.objective || note.o}</p>
                                 </div>
                                 <div>
                                    <h4 className="text-[10px] font-bold text-text/30 uppercase tracking-widest mb-3">Assessment</h4>
                                    <p className="text-sm text-text/70 leading-relaxed">{note.assessment || note.a}</p>
                                 </div>
                                 <div>
                                    <h4 className="text-[10px] font-bold text-text/30 uppercase tracking-widest mb-3">Plan</h4>
                                    <p className="text-sm text-text/70 leading-relaxed">{note.plan || note.p}</p>
                                 </div>
                              </div>
                           </div>
                         ))}
                      </div>
                   )}
                </div>

                {/* Right: Booking Timeline */}
                <div className="lg:col-span-4">
                   <div className="bg-white border border-border rounded-[32px] p-6 shadow-sm sticky top-8">
                      <h3 className="text-sm font-bold text-text/30 uppercase tracking-widest mb-6">Session Timeline</h3>
                      <div className="space-y-6 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-border">
                         {bookings.map((booking) => (
                           <div key={booking.id} className="relative pl-10">
                              <div className={`absolute left-0 top-1 w-[40px] h-[40px] rounded-full border-4 border-white flex items-center justify-center z-10 ${
                                 booking.status === 'completed' ? 'bg-green-500' : 
                                 booking.status === 'cancelled' ? 'bg-red-400' : 'bg-primary'
                              }`}>
                                 {booking.status === 'completed' ? <CheckCircle className="w-4 h-4 text-white" /> : <Calendar className="w-4 h-4 text-white" />}
                              </div>
                              <div>
                                 <p className="text-xs font-bold text-text">{formatLocalTime(booking.appointment_time, country, 'MMM d, h:mm a')}</p>
                                 <p className="text-[11px] font-bold text-text/40">{booking.appointment_type.replace('_', ' ')}</p>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
             </div>
          )}

          {/* COMMUNICATION TAB */}
          {activeTab === 'communication' && (
             <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-8">
                   <h2 className="text-xl font-bold text-text font-bricolage">Messaging History</h2>
                   <button className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-md hover:bg-green-700 transition-all">
                      <MessageSquare className="w-4 h-4" /> Send WhatsApp
                   </button>
                </div>
                
                {messages.length === 0 ? (
                  <div className="py-20 text-center bg-gray-50 rounded-[32px] border border-border">
                     <p className="text-text/30 font-bold">No WhatsApp messages found.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                     {messages.map(msg => (
                        <div key={msg.id} className="bg-white border border-border rounded-[24px] p-6 shadow-sm flex items-start justify-between gap-4">
                           <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                 <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-[10px] font-bold text-text/50 uppercase tracking-widest">{msg.message_type.replace('_', ' ')}</span>
                                 <span className="text-[10px] text-text/30 font-bold">{formatLocalTime(msg.created_at, country, 'PPp', clinicTimezone)}</span>
                              </div>
                              <p className="text-sm font-medium text-text/80 leading-relaxed">
                                {msg.inbound_text || 'Automated reminder / Notification sent via Twilio.'}
                              </p>
                           </div>
                           <div className={`shrink-0 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                              msg.status === 'read' ? 'bg-green-50 text-green-700 border-green-200' :
                              msg.status === 'delivered' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-gray-50 text-gray-500 border-gray-200'
                           }`}>
                              {msg.status}
                           </div>
                        </div>
                     ))}
                  </div>
                )}
             </div>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold text-text font-bricolage">Transaction Ledger</h2>
                  <div className="flex items-baseline gap-2">
                     <span className="text-sm font-bold text-text/30">LIFETIME REVENUE</span>
                     <span className="text-2xl font-bold text-text font-bricolage">£{payments.reduce((acc, p) => acc + (p.amount || 0), 0)}</span>
                  </div>
               </div>

               <div className="bg-white border border-border rounded-[32px] overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="bg-gray-50/50">
                           <th className="px-6 py-4 text-[10px] font-bold text-text/30 uppercase tracking-widest border-b border-border">Date</th>
                           <th className="px-6 py-4 text-[10px] font-bold text-text/30 uppercase tracking-widest border-b border-border">Details</th>
                           <th className="px-6 py-4 text-[10px] font-bold text-text/30 uppercase tracking-widest border-b border-border">Status</th>
                           <th className="px-6 py-4 text-[10px] font-bold text-text/30 uppercase tracking-widest border-b border-border text-right">Amount</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border">
                        {payments.length === 0 ? (
                           <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-text/30 font-bold">No payment history found.</td>
                           </tr>
                        ) : (
                           payments.map(pay => (
                              <tr key={pay.id} className="hover:bg-gray-50/30 transition-colors">
                                 <td className="px-6 py-5">
                                    <p className="text-sm font-bold text-text">{formatLocalTime(pay.recorded_at, country, 'MMM d, yyyy')}</p>
                                    <p className="text-[10px] text-text/30 font-bold uppercase tracking-wider">{formatLocalTime(pay.recorded_at, country, 'h:mm a')}</p>
                                 </td>
                                 <td className="px-6 py-5">
                                    <p className="text-sm font-bold text-text">{pay.notes || 'Session Payment'}</p>
                                 </td>
                                 <td className="px-6 py-5">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                       pay.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                       {pay.payment_status}
                                    </span>
                                 </td>
                                 <td className="px-6 py-5 text-right font-bricolage font-bold text-text">
                                    {pay.currency === 'GBP' ? '£' : pay.currency}{pay.amount}
                                 </td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
          )}

          {/* ADMIN TAB */}
          {activeTab === 'admin' && (
             <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white border border-border rounded-[32px] p-8 shadow-sm">
                   <h2 className="text-xl font-bold text-text font-bricolage mb-6 flex items-center gap-2 text-alert"><Lock className="w-5 h-5" /> Administrative Controls</h2>
                   
                   <div className="space-y-6">
                      <div className="p-6 bg-gray-50 rounded-2xl border border-border">
                         <h3 className="text-sm font-bold text-text mb-2">Export All Patient Data</h3>
                         <p className="text-xs text-text/50 mb-4">Generate a full JSON report of all clinical notes, bookings, and financial history for this patient. Required for certain GDPR subject access requests.</p>
                         <button onClick={handleExportData} className="px-4 py-2 bg-white border border-border rounded-xl text-xs font-bold hover:bg-white flex items-center gap-2 transition-all shadow-sm">
                            <Download className="w-4 h-4" /> Start Export
                         </button>
                      </div>

                      <div className="p-6 bg-gray-50 rounded-2xl border border-border">
                         <h3 className="text-sm font-bold text-text mb-2">Archive Patient</h3>
                         <p className="text-xs text-text/50 mb-4">Mark the patient as inactive. Their data will be hidden from main lists but retained for the 7-year legal minimum requirement.</p>
                         <button onClick={() => setShowArchiveModal(true)} className="px-4 py-2 bg-white border border-border rounded-xl text-xs font-bold hover:bg-white flex items-center gap-2 transition-all shadow-sm">
                            <Archive className="w-4 h-4 text-amber-600" /> Archive Patient
                         </button>
                      </div>

                      <div className="p-6 bg-red-50/50 rounded-2xl border border-red-100">
                         <h3 className="text-sm font-bold text-red-800 mb-2">Permanent Deletion (GDPR Right to Erasure)</h3>
                         <p className="text-xs text-red-600/70 mb-4">Permanently delete ALL data associated with this patient. This action cannot be undone and will bypass legal retention periods if manually triggered by an admin.</p>
                         <button onClick={handleDeletePatient} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 flex items-center gap-2 transition-all shadow-sm">
                            <Trash2 className="w-4 h-4" /> Delete Forever
                         </button>
                      </div>
                   </div>
                </div>
             </div>
          )}

        </div>
      </div>

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-text font-bricolage flex items-center gap-2"><Archive className="w-5 h-5 text-amber-500" /> Archive Patient</h3>
              <button onClick={() => setShowArchiveModal(false)}><X className="w-5 h-5 text-text/40" /></button>
            </div>
            <div className="p-8">
              <p className="text-sm text-text/70 mb-6 leading-relaxed">Are you sure you want to archive <strong>{patient.full_name}</strong>? They will be removed from active lists but their data will be retained for legal compliance.</p>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-[10px] text-text/40 font-bold uppercase tracking-widest leading-normal">
                Policy Note: Medical records must be retained for 7 years from the date of last treatment.
              </div>
            </div>
            <div className="p-8 pt-0 flex gap-3">
              <button onClick={() => setShowArchiveModal(false)} className="flex-1 px-4 py-3 bg-white border border-border rounded-xl font-bold text-text text-sm">Cancel</button>
              <button onClick={handleArchivePatient} disabled={isArchiving} className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md">
                {isArchiving ? <Clock className="w-4 h-4 animate-spin" /> : 'Confirm Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  )
}
