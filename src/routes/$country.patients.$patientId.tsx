import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { 
  Users, 
  Calendar, 
  FileText, 
  Files, 
  History, 
  ChevronRight, 
  Filter, 
  Download, 
  Printer, 
  Plus,
  Clock,
  Activity,
  ArrowUpRight,
  User,
  Phone,
  Mail,
  MapPin,
  Search
} from 'lucide-react'
import { formatLocalTime } from '../lib/date'

export const Route = createFileRoute('/$country/patients/$patientId')({
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
}

type Session = {
  id: string
  appointment_time: string
  status: string
  pain_data: any
  treatment_summary: string
  notes: string
}

type SoapNote = {
  id: string
  created_at: string
  s: string
  o: string
  a: string
  p: string
  type: string
}

function PatientProfilePage() {
  const { country, patientId } = useParams({ strict: false }) as { country: string, patientId: string }
  const [patient, setPatient] = useState<Patient | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [soapNotes, setSoapNotes] = useState<SoapNote[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'history' | 'soap' | 'docs' | 'activity'>('history')
  const [dateFilter, setDateFilter] = useState('All Time')

  useEffect(() => {
    fetchPatientData()
  }, [patientId])

  const fetchPatientData = async () => {
    setLoading(true)
    try {
      // 1. Fetch Patient
      const { data: pData } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()
      
      if (pData) setPatient(pData)

      // 2. Fetch Sessions
      const { data: sData } = await supabase
        .from('bookings')
        .select('*')
        .eq('patient_id', patientId)
        .order('appointment_time', { ascending: false })
      
      if (sData) setSessions(sData)

      // 3. Fetch SOAP Notes
      const { data: nData } = await supabase
        .from('session_notes')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
      
      if (nData) setSoapNotes(nData)

    } catch (e) {
      console.error(e)
      toast.error('Failed to load patient profile')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-700 border-green-200'
      case 'lapsed': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'discharged': return 'bg-gray-100 text-gray-700 border-gray-200'
      default: return 'bg-blue-100 text-blue-700 border-blue-200'
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-8 animate-pulse">
          <div className="h-32 bg-gray-100 rounded-2xl w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="h-64 bg-gray-100 rounded-2xl" />
            <div className="lg:col-span-3 h-64 bg-gray-100 rounded-2xl" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!patient) return <DashboardLayout><div>Patient not found</div></DashboardLayout>

  return (
    <DashboardLayout fullWidth={true}>
      <div className="max-w-7xl mx-auto pb-20">
        
        {/* Breadcrumbs & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2 text-sm text-text/50">
            <Link to="/$country/patients" params={{ country }} className="hover:text-primary transition-colors">Patients</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-text font-medium">{patient.full_name}</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-white border border-border rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
              <Download className="w-4 h-4" /> Export Report
            </button>
            <Link 
              to="/$country/ai/soap-notes" 
              params={{ country }}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4" /> New SOAP Note
            </Link>
          </div>
        </div>

        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Sessions', value: sessions.length, icon: Calendar, color: 'text-blue-600' },
            { label: 'SOAP Notes', value: soapNotes.filter(n => n.type === 'soap').length, icon: FileText, color: 'text-purple-600' },
            { label: 'Avg Pain Improvement', value: '35%', icon: Activity, color: 'text-green-600' },
            { label: 'Attendance Rate', value: '94%', icon: Clock, color: 'text-orange-600' },
          ].map((stat, i) => (
            <div key={i} className="bg-white border border-border p-5 rounded-2xl shadow-sm hover:border-primary/20 transition-all group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-text/40 uppercase tracking-widest">{stat.label}</span>
                <stat.icon className={`w-4 h-4 ${stat.color} opacity-60 group-hover:scale-110 transition-transform`} />
              </div>
              <div className="text-2xl font-bold text-text font-bricolage">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Left Panel: Patient Info */}
          <div className="space-y-6">
            <div className="bg-white border border-border rounded-2xl p-6 shadow-sm sticky top-8">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-4 border border-primary/10">
                  <User className="w-10 h-10 text-primary/40" />
                </div>
                <h2 className="text-xl font-bold text-text font-bricolage">{patient.full_name}</h2>
                <span className={`mt-2 px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(patient.status_tag)}`}>
                  {patient.status_tag || 'Active'}
                </span>
              </div>

              <div className="space-y-4 pt-6 border-t border-border/50">
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-text/30 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-text/30 uppercase tracking-widest">Date of Birth</p>
                    <p className="text-sm text-text/80">{patient.date_of_birth ? formatLocalTime(patient.date_of_birth, country, 'MMM d, yyyy') : 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-text/30 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-text/30 uppercase tracking-widest">Phone</p>
                    <p className="text-sm text-text/80">{patient.phone_number}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-text/30 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-text/30 uppercase tracking-widest">Email</p>
                    <p className="text-sm text-text/80 truncate max-w-[180px]">{patient.email || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-text/30 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-text/30 uppercase tracking-widest">Complaint</p>
                    <p className="text-sm text-text/80">{patient.primary_complaint}</p>
                  </div>
                </div>
              </div>

              <button className="w-full mt-8 py-2.5 bg-gray-50 border border-border rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 text-text/60">
                Edit Profile <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Panel: Content Area */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Date Filters & Tab Selector */}
            <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="p-2 border-b border-border bg-gray-50/50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex p-1 bg-white border border-border rounded-xl shadow-sm">
                  {[
                    { id: 'history', label: 'Session History', icon: Calendar },
                    { id: 'soap', label: 'SOAP Notes', icon: FileText },
                    { id: 'docs', label: 'Docs & Files', icon: Files },
                    { id: 'activity', label: 'Activity', icon: History },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-md' : 'text-text/50 hover:text-text'}`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span className={activeTab === tab.id ? 'block' : 'hidden sm:block'}>{tab.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 px-3">
                  <Filter className="w-4 h-4 text-text/30" />
                  <select 
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="bg-transparent text-sm font-bold text-text/60 outline-none cursor-pointer"
                  >
                    {['Today', 'This Week', 'This Month', 'Last 3 Months', 'This Year', 'All Time'].map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                
                {activeTab === 'history' && (
                  <div className="space-y-6 animate-in fade-in duration-500">
                    {sessions.length === 0 ? (
                      <div className="py-20 text-center flex flex-col items-center">
                        <Calendar className="w-12 h-12 text-text/10 mb-4" />
                        <p className="text-text/40 font-medium">No sessions recorded yet.</p>
                      </div>
                    ) : (
                      sessions.map((session, i) => (
                        <div key={session.id} className="relative pl-8 pb-8 last:pb-0 group">
                          {/* Timeline connector */}
                          {i !== sessions.length - 1 && (
                            <div className="absolute left-[11px] top-[26px] bottom-0 w-0.5 bg-gray-100 group-hover:bg-primary/20 transition-colors" />
                          )}
                          <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full border-2 border-white bg-gray-100 shadow-sm flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                            <div className="w-2 h-2 rounded-full bg-gray-400 group-hover:bg-primary transition-colors" />
                          </div>

                          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-text font-bricolage">{formatLocalTime(session.appointment_time, country, 'EEEE, MMMM d')}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${session.status === 'completed' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                  {session.status}
                                </span>
                              </div>
                              <span className="text-xs font-medium text-text/40">{formatLocalTime(session.appointment_time, country, 'h:mm a')}</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold text-text/30 uppercase tracking-widest">Pain & Treatment</p>
                                <p className="text-sm text-text/70 line-clamp-2">{session.treatment_summary || 'No summary provided.'}</p>
                              </div>
                              <div className="flex justify-end items-end">
                                <button className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                                  View Full Session <ArrowUpRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'soap' && (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex items-center justify-between mb-6">
                      <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/30" />
                        <input 
                          type="text" 
                          placeholder="Search SOAP notes..."
                          className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-sm focus:border-primary outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-gray-100 rounded-lg text-text/50" title="Print All"><Printer className="w-4 h-4" /></button>
                      </div>
                    </div>

                    {soapNotes.filter(n => n.type === 'soap').length === 0 ? (
                      <div className="py-20 text-center flex flex-col items-center">
                        <FileText className="w-12 h-12 text-text/10 mb-4" />
                        <p className="text-text/40 font-medium">No SOAP notes found for this patient.</p>
                      </div>
                    ) : (
                      soapNotes.filter(n => n.type === 'soap').map(note => (
                        <div key={note.id} className="bg-white border border-border rounded-2xl overflow-hidden hover:shadow-md transition-all">
                          <div className="p-4 border-b border-border bg-gray-50/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-text">{formatLocalTime(note.created_at, country, 'MMM d, yyyy')}</span>
                              <span className="text-[10px] font-bold text-primary uppercase tracking-widest px-2 py-0.5 bg-primary/5 rounded border border-primary/10">AI Assisted</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button className="p-1.5 hover:bg-white text-text/30 hover:text-primary rounded transition-all"><Download className="w-3.5 h-3.5" /></button>
                              <button className="p-1.5 hover:bg-white text-text/30 hover:text-primary rounded transition-all"><Printer className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-[9px] font-bold text-text/30 uppercase tracking-widest mb-1">Subjective (S)</p>
                              <p className="text-xs text-text/70 line-clamp-3">{note.s || '-'}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-text/30 uppercase tracking-widest mb-1">Plan (P)</p>
                              <p className="text-xs text-text/70 line-clamp-3">{note.p || '-'}</p>
                            </div>
                          </div>
                          <div className="px-5 py-2 border-t border-border/50 flex justify-end">
                            <button className="text-[10px] font-bold text-primary hover:underline">Expand Full Note</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'docs' && (
                  <div className="py-20 text-center flex flex-col items-center animate-in fade-in">
                    <Files className="w-12 h-12 text-text/10 mb-4" />
                    <p className="text-text/40 font-medium">No documents or files uploaded yet.</p>
                    <button className="mt-4 px-6 py-2 bg-primary/5 text-primary border border-primary/10 rounded-xl text-sm font-bold hover:bg-primary/10 transition-all">
                      Upload Document
                    </button>
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="py-20 text-center flex flex-col items-center animate-in fade-in">
                    <History className="w-12 h-12 text-text/10 mb-4" />
                    <p className="text-text/40 font-medium">Activity timeline coming soon.</p>
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
