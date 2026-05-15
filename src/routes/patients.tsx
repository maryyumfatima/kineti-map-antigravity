import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Search, Plus, Users, X, Upload, Sparkles, Loader2, Brain, ChevronRight, ChevronDown } from 'lucide-react'
import { formatLocalTime } from '../lib/date'
import { PhoneInput } from '../components/PhoneInput'
import { generatePainSummary } from '../lib/groq'

export const Route = createFileRoute('/patients')({
  component: PatientsPage,
})

type Patient = {
  id: string
  full_name: string
  phone_number: string
  email: string | null
  date_of_birth: string | null
  primary_complaint: string
  referral_source: string | null
  status_tag: 'active' | 'lapsed' | 'discharged' | 'no-show'
  last_session_date: string | null
  gdpr_consent: boolean
  ai_pain_summary?: string | null
}

// Removed PatientPhoneInput in favor of shared component

function PatientsPage() {
    const navigate = useNavigate()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [segment, setSegment] = useState('All Time')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [clinicId, setClinicId] = useState<string | null>(null)

  // Modal state
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    date_of_birth: '',
    primary_complaint: 'Lower Back',
    referral_source: 'Self-referred',
    gdpr_consent: false,
  })

  // Drawer state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [drawerFormData, setDrawerFormData] = useState<Partial<Patient>>({})
  const [isDrawerSaving, setIsDrawerSaving] = useState(false)

  // CSV Import State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)

  // AI Pain Summary state
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [clinicData, setClinicData] = useState<any>(null)

  useEffect(() => {
    fetchPatients()
    fetchClinicData()
  }, [])

  const fetchClinicData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: cu } = await supabase.from('clinic_users').select('clinic_id').eq('auth_user_id', user.id).single()
      if (!cu) return
      const { data: clinic } = await supabase.from('clinics').select('subscription_plan, ai_credits_used').eq('id', cu.clinic_id).single()
      setClinicData(clinic)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchPatients = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: clinicUser } = await supabase
        .from('clinic_users')
        .select('clinic_id')
        .eq('auth_user_id', user.id)
        .single()

      if (!clinicUser) return
      setClinicId(clinicUser.clinic_id)

      const { data: patientsData, error } = await supabase
        .from('patients')
        .select('*')
        .eq('clinic_id', clinicUser.clinic_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (patientsData) setPatients(patientsData)

      // Fetch timezone
      const { data: clinic } = await supabase.from('clinics').select('timezone').eq('id', clinicUser.clinic_id).single()
      if (clinic) setClinicData(prev => ({ ...prev, timezone: clinic.timezone }))
    } catch (error) {
      console.error(error)
      toast.error('Failed to load patients')
    } finally {
      setLoading(false)
    }
  }

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clinicId) {
      toast.error('Clinic ID not found')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase.from('patients').insert([{
        clinic_id: clinicId,
        full_name: formData.full_name,
        phone_number: formData.phone_number,
        email: formData.email || null,
        date_of_birth: formData.date_of_birth,
        primary_complaint: formData.primary_complaint,
        referral_source: formData.referral_source,
        gdpr_consent: formData.gdpr_consent,
        consent_date: formData.gdpr_consent ? new Date().toISOString() : null,
        status_tag: 'active'
      }])

      if (error) throw error

      toast.success('Patient added successfully')
      setIsModalOpen(false)
      setFormData({
        full_name: '', phone_number: '', email: '', date_of_birth: '',
        primary_complaint: 'Lower Back', referral_source: 'Self-referred', gdpr_consent: false
      })
      fetchPatients()
    } catch (error) {
      console.error(error)
      toast.error('Failed to save patient')
    } finally {
      setIsSaving(false)
    }
  }



  const handleGeneratePainSummary = async () => {
    if (!selectedPatient || !clinicId) return

    // Gate check
    const used = clinicData?.ai_credits_used || 0
    const plan = clinicData?.subscription_plan || 'trial'
    let limit = 999999
    if (plan === 'trial') limit = 5
    else if (plan === 'essentials') limit = 200
    else if (plan === 'growth') limit = 600
    else if (plan === 'scale') limit = 1500

    if (used >= limit) {
      toast.error(`AI credit limit (${limit}) reached. Upgrade your plan for more.`)
      return
    }

    setGeneratingSummary(true)
    try {
      // Fetch last 10 session pain scores
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('pain_data')
        .eq('patient_id', selectedPatient.id)
        .eq('status', 'completed')
        .order('appointment_time', { ascending: false })
        .limit(10)
      
      if (error) throw error

      const scores = (bookings || [])
        .map(b => {
          if (!b.pain_data) return null
          const vals = Object.values(b.pain_data as Record<string, number>)
          if (vals.length === 0) return null
          return vals.reduce((a, b) => a + b, 0) / vals.length
        })
        .filter((s): s is number => s !== null)
        .reverse() // oldest to newest

      if (scores.length === 0) {
        toast.error('No pain scores found for this patient yet.')
        setGeneratingSummary(false)
        return
      }

      const summary = await generatePainSummary(scores)
      setAiSummary(summary)

      // Save to patient record
      await supabase
        .from('patients')
        .update({ ai_pain_summary: summary })
        .eq('id', selectedPatient.id)

      // Track usage
      await supabase.from('clinics').update({ ai_credits_used: used + 1 }).eq('id', clinicId)
      setClinicData({ ...clinicData, ai_credits_used: used + 1 })
      
      toast.success('AI Summary generated and saved')
    } catch (error) {
      console.error(error)
      toast.error('Failed to generate summary')
    } finally {
      setGeneratingSummary(false)
    }
  }

  const handleSaveDrawer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPatient) return

    setIsDrawerSaving(true)
    try {
      const updates = {
        full_name: drawerFormData.full_name,
        phone_number: drawerFormData.phone_number,
        email: drawerFormData.email || null,
        date_of_birth: drawerFormData.date_of_birth || null,
        primary_complaint: drawerFormData.primary_complaint,
        referral_source: drawerFormData.referral_source || null,
        status_tag: drawerFormData.status_tag,
        gdpr_consent: drawerFormData.gdpr_consent,
      }

      const { error } = await supabase
        .from('patients')
        .update(updates)
        .eq('id', selectedPatient.id)

      if (error) throw error

      toast.success('Patient updated successfully')

      // Update local state
      const updatedPatient = { ...selectedPatient, ...updates } as Patient
      setPatients(patients.map(p => p.id === selectedPatient.id ? updatedPatient : p))
      setSelectedPatient(updatedPatient)
      setDrawerFormData(updatedPatient)
      setIsEditing(false)
    } catch (error) {
      console.error(error)
      toast.error('Failed to update patient')
    } finally {
      setIsDrawerSaving(false)
    }
  }

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return

      const rows = text.split('\n').filter(r => r.trim()).map(r => r.split(',').map(c => c.trim()?.replace(/^"|"$/g, '') ?? ''))
      if (rows.length < 2) { toast.error('CSV must have headers and at least 1 row'); return }

      setCsvHeaders(rows[0])
      setCsvRows(rows.slice(1))
      setIsCsvModalOpen(true)

      const initialMap: Record<string, string> = {}
      rows[0].forEach((h) => {
        const hl = (h ?? '').toLowerCase()
        if (hl.includes('name')) initialMap[h] = 'full_name'
        else if (hl.includes('phone') || hl.includes('whatsapp') || hl.includes('number')) initialMap[h] = 'phone_number'
        else if (hl.includes('email')) initialMap[h] = 'email'
        else if (hl.includes('dob') || hl.includes('birth')) initialMap[h] = 'date_of_birth'
        else if (hl.includes('complaint') || hl.includes('pain') || hl.includes('issue')) initialMap[h] = 'primary_complaint'
        else initialMap[h] = 'skip'
      })
      setCsvMapping(initialMap)
    }
    reader.readAsText(file)
    e.target.value = '' // reset input
  }

  const handleImportCsv = async () => {
    if (!clinicId) return
    setImporting(true)
    try {
      const patientsToInsert = csvRows.map(row => {
        const p: any = { clinic_id: clinicId, gdpr_consent: false, status_tag: 'active', referral_source: 'Import' }
        csvHeaders.forEach((h, i) => {
          const mapTo = csvMapping[h]
          if (mapTo && mapTo !== 'skip') {
            p[mapTo] = row[i]
          }
        })
        return p
      }).filter(p => p.full_name && p.phone_number)

      if (patientsToInsert.length === 0) {
        toast.error('No valid patients found. Please map Name and Phone columns.')
        setImporting(false)
        return
      }

      let successCount = 0
      for (const p of patientsToInsert) {
        const { error } = await supabase.rpc('upsert_patient', { ...p, source: 'csv_import' })
        if (error) {
          const { data: inserted } = await supabase.from('patients').upsert(p, { onConflict: 'clinic_id,phone_number' }).select().single()
          if (inserted) {
            await supabase.from('patient_activity_log').insert({
              patient_id: inserted.id, clinic_id: clinicId, action: 'created', source: 'csv_import'
            })
            successCount++
          }
        } else {
          successCount++
        }
      }

      toast.success(`${successCount} patients imported successfully`)
      setIsCsvModalOpen(false)
      fetchPatients()
    } catch (e) {
      console.error(e)
      toast.error('Failed to import patients')
    } finally {
      setImporting(false)
    }
  }

  const KINETIMAP_FIELDS = [
    { value: 'skip', label: 'Skip this column' },
    { value: 'full_name', label: 'Full name' },
    { value: 'phone_number', label: 'Phone number' },
    { value: 'email', label: 'Email' },
    { value: 'date_of_birth', label: 'Date of birth' },
    { value: 'primary_complaint', label: 'Primary complaint' },
  ]

  const toggleConsent = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from('patients')
        .update({ gdpr_consent: !current })
        .eq('id', id)

      if (error) throw error

      setPatients(patients.map(p => p.id === id ? { ...p, gdpr_consent: !current } : p))
      toast.success('Consent updated')
    } catch (error) {
      toast.error('Failed to update consent')
    }
  }

  const getStatusColor = (status: string) => {
    switch ((status ?? '').toLowerCase()) {
      case 'active': return 'bg-primary/10 text-primary border-primary/20'
      case 'lapsed': return 'bg-[#D9B29C]/20 text-[#B88B71] border-[#D9B29C]/30'
      case 'discharged': return 'bg-gray-100 text-gray-700 border-gray-200'
      case 'no-show': return 'bg-alert/10 text-alert border-alert/20'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const filteredPatients = patients.filter(p => {
    const matchesSearch = (p.full_name ?? '').toLowerCase().includes((search ?? '').toLowerCase()) ||
      (p.phone_number ?? '').includes(search) ||
      (p.status_tag ?? '').toLowerCase().includes((search ?? '').toLowerCase())
    
    const matchesFilter = filter === 'All' || (p.status_tag ?? '').toLowerCase() === (filter ?? '').toLowerCase()
    
    // Segmentation filter logic
    let matchesSegment = true
    if (segment !== 'All Time') {
      const now = new Date()
      const lastSession = p.last_session_date ? new Date(p.last_session_date) : null
      if (!lastSession) {
        matchesSegment = false
      } else {
        const diffDays = Math.floor((now.getTime() - lastSession.getTime()) / (1000 * 60 * 60 * 24))
        if (segment === 'Weekly') matchesSegment = diffDays <= 7
        else if (segment === 'Monthly') matchesSegment = diffDays <= 30
        else if (segment === 'Yearly') matchesSegment = diffDays <= 365
      }
    }

    return matchesSearch && matchesFilter && matchesSegment
  })

  // Pagination logic
  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage)
  const paginatedPatients = filteredPatients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Status calculation logic (Issue 6)
  const getCalculatedStatus = (p: Patient) => {
    if (p.status_tag === 'discharged') return 'discharged'
    if (!p.last_session_date) return 'active' // or 'new'
    
    const now = new Date()
    const lastSession = new Date(p.last_session_date)
    const diffDays = Math.floor((now.getTime() - lastSession.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays <= 30) return 'active'
    if (diffDays <= 90) return 'lapsed'
    return 'lapsed' // or 'inactive'
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto animate-in fade-in duration-700">
        {/* Background Decorative Element */}
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-[32px] font-bold text-primary font-bricolage leading-tight">Patient Directory</h1>
            <p className="text-text/50 text-sm mt-1">Manage and track your clinic's patient records.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={() => document.getElementById('csv-import-patients')?.click()}
              className="flex-1 md:flex-none bg-white border border-border hover:bg-gray-50 text-text px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <div className="flex items-center gap-3 flex-1 md:flex-none">
              <input type="file" id="csv-import-patients" accept=".csv" className="hidden" onChange={handleCsvUpload} />
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full btn-premium bg-primary text-white px-6 py-2.5 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:opacity-90 active:scale-95"
              >
                <Plus className="w-5 h-5" />
                Add Patient
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-border overflow-hidden shadow-xl shadow-primary/5 transition-all">
          {/* Advanced Filters Bar */}
          <div className="p-5 border-b border-border space-y-4 bg-white/50">
            <div className="flex flex-col lg:flex-row justify-between gap-4">
              <div className="relative flex-1 group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text/30 group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Search by name, phone, or status..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/50 focus:bg-white focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 text-sm transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-background/50 p-1 rounded-xl border border-border/50">
                  {['All', 'Active', 'Lapsed', 'Discharged'].map(f => (
                    <button
                      key={f}
                      onClick={() => { setFilter(f); setCurrentPage(1); }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === f ? 'bg-primary text-white shadow-md' : 'text-text/40 hover:text-text/70'
                        }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className="flex bg-background/50 p-1 rounded-xl border border-border/50">
                  {['All Time', 'Weekly', 'Monthly', 'Yearly'].map(s => (
                    <button
                      key={s}
                      onClick={() => { setSegment(s); setCurrentPage(1); }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${segment === s ? 'bg-accent text-white shadow-md' : 'text-text/40 hover:text-text/70'
                        }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

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
          ) : filteredPatients.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-6">
                <Users className="w-10 h-10 text-primary/30" />
              </div>
              <h3 className="text-xl font-bold text-text font-bricolage mb-2">No patients found</h3>
              <p className="text-text/50 max-w-sm mb-8">
                Start building your clinic's database by adding your first patient or importing from a CSV.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-premium bg-primary text-white px-6 py-2.5 rounded-lg shadow-lg shadow-primary/20 flex items-center gap-2 hover:opacity-90"
              >
                <Plus className="w-5 h-5" /> Add First Patient
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background/50 border-b border-border text-sm font-medium text-text/70">
                    <th className="p-4 font-medium">Name</th>
                    <th className="p-4 font-medium">Phone number</th>
                    <th className="p-4 font-medium">Primary complaint</th>
                    <th className="p-4 font-medium">Status tag</th>
                    <th className="p-4 font-medium">Last session</th>
                    <th className="p-4 font-medium">Consent</th>
                    <th className="p-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPatients.map((patient, idx) => (
                    <tr 
                      key={patient.id} 
                      onClick={() => navigate({ to: '/patients/$patientId', params: { country, patientId: patient.id } as any })}
                      className={`
                        border-b border-border last:border-0 cursor-pointer group transition-all duration-300
                        ${idx % 2 === 0 ? 'bg-white' : 'bg-primary/[0.01]'}
                        hover:bg-primary/[0.04]
                      `}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary text-[10px] font-bold border border-primary/10 group-hover:bg-primary group-hover:text-white transition-all">
                            {patient.full_name.charAt(0)}
                          </div>
                          <span className="font-bold text-text text-sm group-hover:text-primary transition-colors">{patient.full_name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-text/60 text-sm">{patient.phone_number}</td>
                      <td className="p-4 text-text/60 text-sm font-medium">{patient.primary_complaint}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(getCalculatedStatus(patient))}`}>
                          {getCalculatedStatus(patient)}
                        </span>
                      </td>
                      <td className="p-4 text-text/40 text-xs">
                        {patient.last_session_date ? formatLocalTime(patient.last_session_date, country, 'MMM d, yyyy', clinicData?.timezone) : 'New Patient'}
                      </td>
                      <td className="p-4" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => toggleConsent(patient.id, patient.gdpr_consent)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shadow-inner ${patient.gdpr_consent ? 'bg-primary' : 'bg-gray-200'
                            }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${patient.gdpr_consent ? 'translate-x-4' : 'translate-x-1'
                            }`} />
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <ChevronRight className="w-4 h-4 text-text/20 group-hover:text-primary group-hover:translate-x-1 transition-all inline-block" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {!loading && totalPages > 1 && (
            <div className="p-4 border-t border-border bg-gray-50/50 flex items-center justify-between">
              <span className="text-xs text-text/40 font-medium">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredPatients.length)} of {filteredPatients.length} patients
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-border rounded-lg bg-white text-text/60 hover:text-primary disabled:opacity-30 transition-all"
                >
                  <ChevronDown className="w-4 h-4 rotate-90" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === p ? 'bg-primary text-white' : 'bg-white border border-border text-text/40 hover:text-primary'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-border rounded-lg bg-white text-text/60 hover:text-primary disabled:opacity-30 transition-all"
                >
                  <ChevronDown className="w-4 h-4 -rotate-90" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-white sticky top-0 z-10">
              <h2 className="text-xl font-bold text-primary font-bricolage">Add Patient</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-text/50 hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form id="add-patient-form" onSubmit={handleSavePatient} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Full name *</label>
                  <input required type="text" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">WhatsApp / Phone *</label>
                  <PhoneInput 
                    value={formData.phone_number} 
                    onChange={v => setFormData({...formData, phone_number: v || ''})} 
                    defaultCountry={country ? country.toUpperCase() : 'GB'}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-white focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Date of birth *</label>
                  <input required type="date" value={formData.date_of_birth} onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Primary complaint</label>
                  <select value={formData.primary_complaint} onChange={e => setFormData({ ...formData, primary_complaint: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white">
                    {['Lower Back', 'Neck', 'Shoulder', 'Knee', 'Hip', 'Ankle', 'Wrist/Hand', 'Head', 'Other'].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Referral source</label>
                  <select value={formData.referral_source} onChange={e => setFormData({ ...formData, referral_source: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white">
                    {['Self-referred', 'GP Referral', 'Insurance', 'Walk-in'].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-start gap-3 mt-4">
                  <input required type="checkbox" id="gdpr" checked={formData.gdpr_consent} onChange={e => setFormData({ ...formData, gdpr_consent: e.target.checked })} className="mt-1" />
                  <label htmlFor="gdpr" className="text-sm text-text/80">I confirm that the patient has provided GDPR consent for their data to be stored and processed. *</label>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-border bg-background sticky bottom-0 z-10 flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg font-medium text-text hover:bg-black/5 transition-colors">
                Cancel
              </button>
              <button type="submit" form="add-patient-form" disabled={isSaving} className="bg-primary hover:opacity-90 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-70">
                {isSaving ? 'Saving...' : 'Save Patient'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCsvModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-white sticky top-0 z-10">
              <h2 className="text-xl font-bold text-primary font-bricolage">Import Patients</h2>
              <button onClick={() => { setIsCsvModalOpen(false); }} className="text-text/50 hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
              <p className="text-sm text-text/70 mb-4">Map your CSV columns to KinetiMap fields.</p>

              <div className="bg-white border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border bg-gray-50 flex justify-between items-center">
                  <h4 className="font-semibold text-sm">Detected Columns</h4>
                </div>
                <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                  {csvHeaders.map((h) => (
                    <div key={h} className="p-3 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                      <span className="text-sm font-medium text-text truncate flex-1" title={h}>{h}</span>
                      <select
                        value={csvMapping[h] || 'skip'}
                        onChange={(e) => setCsvMapping({ ...csvMapping, [h]: e.target.value })}
                        className="w-[180px] text-sm border border-border rounded-md px-2 py-1.5 outline-none focus:border-primary bg-white"
                      >
                        {KINETIMAP_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {importing && (
                <div className="w-full bg-gray-200 rounded-full h-2 mt-6 overflow-hidden">
                  <div className="bg-primary h-2 rounded-full animate-pulse w-full"></div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border bg-background sticky bottom-0 z-10 flex justify-end gap-3">
              <button type="button" onClick={() => { setIsCsvModalOpen(false); }} className="px-4 py-2 rounded-lg font-medium text-text hover:bg-black/5 transition-colors">
                Cancel
              </button>
              <button onClick={handleImportCsv} disabled={importing} className="bg-primary hover:opacity-90 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-70">
                {importing ? 'Importing...' : `Import ${csvRows.length} patients`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Overlay */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 fade-in ${isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsDrawerOpen(false)}
      />

      {/* Right Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col drawer-in ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {selectedPatient && (
          <>
            <div className="p-6 border-b border-border flex justify-between items-center bg-white">
              <h2 className="text-xl font-bold text-primary font-bricolage">Patient Details</h2>
              <div className="flex gap-2">
                {!isEditing ? (
                  <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 text-sm font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                    Edit
                  </button>
                ) : null}
                <button onClick={() => setIsDrawerOpen(false)} className="text-text/50 hover:text-text p-1.5 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="edit-patient-form" onSubmit={handleSaveDrawer} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Full name</label>
                  <input
                    required
                    type="text"
                    value={drawerFormData.full_name || ''}
                    onChange={e => setDrawerFormData({ ...drawerFormData, full_name: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none disabled:bg-gray-50 disabled:text-text/80"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Phone number</label>
                  <PhoneInput 
                    value={drawerFormData.phone_number || ''} 
                    onChange={v => setDrawerFormData({...drawerFormData, phone_number: v || ''})} 
                    disabled={!isEditing}
                    defaultCountry={country ? country.toUpperCase() : 'GB'}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-white focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Email</label>
                  <input
                    type="email"
                    value={drawerFormData.email || ''}
                    onChange={e => setDrawerFormData({ ...drawerFormData, email: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none disabled:bg-gray-50 disabled:text-text/80"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Date of birth</label>
                  <input
                    type="date"
                    value={drawerFormData.date_of_birth || ''}
                    onChange={e => setDrawerFormData({ ...drawerFormData, date_of_birth: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none disabled:bg-gray-50 disabled:text-text/80"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Primary complaint</label>
                  <select
                    value={drawerFormData.primary_complaint || ''}
                    onChange={e => setDrawerFormData({ ...drawerFormData, primary_complaint: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none disabled:bg-gray-50 disabled:text-text/80 disabled:opacity-100"
                  >
                    {['Lower Back', 'Neck', 'Shoulder', 'Knee', 'Hip', 'Ankle', 'Wrist/Hand', 'Head', 'Other'].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Status tag</label>
                  <select
                    value={drawerFormData.status_tag || 'active'}
                    onChange={e => setDrawerFormData({ ...drawerFormData, status_tag: e.target.value as any })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none disabled:bg-gray-50 disabled:text-text/80 disabled:opacity-100"
                  >
                    {['active', 'lapsed', 'discharged', 'no-show'].map(opt => (
                      <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Referral source</label>
                  <select
                    value={drawerFormData.referral_source || ''}
                    onChange={e => setDrawerFormData({ ...drawerFormData, referral_source: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none disabled:bg-gray-50 disabled:text-text/80 disabled:opacity-100"
                  >
                    <option value="">Select source</option>
                    {['Self-referred', 'GP Referral', 'Insurance', 'Walk-in', 'Import'].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-start gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="drawer-gdpr"
                    checked={drawerFormData.gdpr_consent || false}
                    onChange={e => setDrawerFormData({ ...drawerFormData, gdpr_consent: e.target.checked })}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                  <label htmlFor="drawer-gdpr" className="text-sm text-text/80">GDPR consent provided</label>
                </div>

                {/* AI Pain Summary Section */}
                <div className="pt-6 border-t border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-text flex items-center gap-2">
                      <Brain className="w-4 h-4 text-primary" />
                      AI Clinical Analysis
                    </h3>
                    {!aiSummary && (
                      <button
                        type="button"
                        onClick={handleGeneratePainSummary}
                        disabled={generatingSummary}
                        className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all font-bold shadow-sm"
                      >
                        {generatingSummary ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {generatingSummary ? 'Analyzing...' : 'Generate Summary'}
                      </button>
                    )}
                  </div>

                  {aiSummary ? (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Pain Trend Summary</span>
                        <button type="button" onClick={() => setAiSummary(null)} className="text-[10px] text-text/40 hover:text-text">Clear</button>
                      </div>
                      <p className="text-sm text-text/80 leading-relaxed italic">"{aiSummary}"</p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-dashed border-border rounded-xl p-4 text-center">
                      <p className="text-xs text-text/40">No AI analysis generated yet. Click above to analyze last 10 session trends.</p>
                    </div>
                  )}
                </div>

                {!isEditing && drawerFormData.last_session_date && (
                  <div className="pt-4 border-t border-border mt-4">
                    <p className="text-sm font-medium text-text/70 mb-1">Last session date</p>
                    <p className="text-text">{formatLocalTime(drawerFormData.last_session_date, country, 'MMM d, yyyy')}</p>
                  </div>
                )}
              </form>
            </div>

            {isEditing && (
              <div className="p-6 border-t border-border bg-background flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setDrawerFormData(selectedPatient)
                  }}
                  className="px-4 py-2 rounded-lg font-medium text-text hover:bg-black/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="edit-patient-form"
                  disabled={isDrawerSaving}
                  className="bg-primary hover:opacity-90 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-70"
                >
                  {isDrawerSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
