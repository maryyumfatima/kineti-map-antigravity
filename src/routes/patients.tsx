import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Search, Plus, Users, X, Upload } from 'lucide-react'

export const Route = createFileRoute('/patients')({
  component: PatientsPage,
})

type Patient = {
  id: string
  full_name: string
  phone_number: string
  email: string | null
  primary_complaint: string
  status_tag: 'active' | 'lapsed' | 'discharged' | 'no-show'
  last_session_date: string | null
  gdpr_consent: boolean
}

function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
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

  // CSV Import State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    fetchPatients()
  }, [])

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

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return
      
      const rows = text.split('\n').filter(r => r.trim()).map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')))
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
    switch((status ?? '').toLowerCase()) {
      case 'active': return 'bg-primary/10 text-primary border-primary/20'
      case 'lapsed': return 'bg-[#D9B29C]/20 text-[#B88B71] border-[#D9B29C]/30'
      case 'discharged': return 'bg-gray-100 text-gray-700 border-gray-200'
      case 'no-show': return 'bg-alert/10 text-alert border-alert/20'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const filteredPatients = patients.filter(p => {
    const matchesSearch = (p.full_name ?? '').toLowerCase().includes((search ?? '').toLowerCase()) || 
                          (p.phone_number ?? '').includes(search)
    const matchesFilter = filter === 'All' || (p.status_tag ?? '').toLowerCase() === (filter ?? '').toLowerCase()
    return matchesSearch && matchesFilter
  })

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-[28px] font-bold text-primary font-bricolage">Patients</h1>
          <div className="flex gap-3">
            <button 
              onClick={() => document.getElementById('csv-import-patients')?.click()}
              className="bg-white border border-border hover:bg-gray-50 text-text px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Upload className="w-5 h-5" />
              Import CSV
            </button>
            <input type="file" id="csv-import-patients" accept=".csv" className="hidden" onChange={handleCsvUpload} />
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Patient
            </button>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between gap-4 items-center bg-white">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/50" />
              <input 
                type="text" 
                placeholder="Search by name or phone..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
              />
            </div>
            
            <div className="flex bg-background p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
              {['All', 'Active', 'Lapsed', 'Discharged', 'No-Show'].map(f => (
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
            <div className="p-12 text-center text-text/70">Loading patients...</div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-text/50">
              <Users className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-medium text-text/70">No patients yet. Add your first patient.</p>
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
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id} className="border-b border-border last:border-0 hover:bg-background/30 transition-colors">
                      <td className="p-4 font-medium text-text">{patient.full_name}</td>
                      <td className="p-4 text-text/80">{patient.phone_number}</td>
                      <td className="p-4 text-text/80">{patient.primary_complaint}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(patient.status_tag)}`}>
                          {(patient.status_tag ?? '').charAt(0).toUpperCase() + (patient.status_tag ?? '').slice(1)}
                        </span>
                      </td>
                      <td className="p-4 text-text/80">
                        {patient.last_session_date ? new Date(patient.last_session_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="p-4">
                        <button 
                          onClick={() => toggleConsent(patient.id, patient.gdpr_consent)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            patient.gdpr_consent ? 'bg-primary' : 'bg-gray-300'
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            patient.gdpr_consent ? 'translate-x-4' : 'translate-x-1'
                          }`} />
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <Link 
                          to="/dashboard/patients/$id" 
                          params={{ id: patient.id }}
                          className="text-primary hover:underline text-sm font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  <input required type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">WhatsApp / Phone *</label>
                  <input required type="tel" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Date of birth *</label>
                  <input required type="date" value={formData.date_of_birth} onChange={e => setFormData({...formData, date_of_birth: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Primary complaint</label>
                  <select value={formData.primary_complaint} onChange={e => setFormData({...formData, primary_complaint: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white">
                    {['Lower Back', 'Neck', 'Shoulder', 'Knee', 'Hip', 'Ankle', 'Wrist/Hand', 'Head', 'Other'].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Referral source</label>
                  <select value={formData.referral_source} onChange={e => setFormData({...formData, referral_source: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white">
                    {['Self-referred', 'GP Referral', 'Insurance', 'Walk-in'].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-start gap-3 mt-4">
                  <input required type="checkbox" id="gdpr" checked={formData.gdpr_consent} onChange={e => setFormData({...formData, gdpr_consent: e.target.checked})} className="mt-1" />
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
                        onChange={(e) => setCsvMapping({...csvMapping, [h]: e.target.value})}
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
    </DashboardLayout>
  )
}
