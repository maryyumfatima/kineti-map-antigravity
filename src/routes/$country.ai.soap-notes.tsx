import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { generateSoapNote } from '../lib/groq'
import { 
  Sparkles, 
  User, 
  Activity, 
  Stethoscope, 
  Clock, 
  Calendar, 
  MessageSquare, 
  Loader2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

export const Route = createFileRoute('/$country/ai/soap-notes')({
  component: SoapNotesPage,
})

const BODY_PARTS = ['Lower Back', 'Neck', 'Shoulder', 'Knee', 'Hip', 'Wrist/Hand', 'Ankle/Foot', 'Other']
const TREATMENTS = ['Manual Therapy', 'Ultrasound', 'TENS', 'Exercise Therapy', 'Dry Needling', 'Heat/Ice', 'Taping', 'Other']
const NEXT_SESSION_OPTIONS = ['2 days', '3 days', '1 week', '2 weeks', 'Discharge']

function SoapNotesPage() {
  const [patients, setPatients] = useState<any[]>([])
  const [clinicData, setClinicData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  // Step 1 Form State
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedBodyParts, setSelectedBodyParts] = useState<string[]>([])
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([])
  const [painBefore, setPainBefore] = useState(5)
  const [painAfter, setPainAfter] = useState(3)
  const [duration, setDuration] = useState(30)
  const [nextSession, setNextSession] = useState('1 week')
  const [additionalNotes, setAdditionalNotes] = useState('')

  // Step 3 Output State
  const [generatedNote, setGeneratedNote] = useState<{
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  } | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
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

      // Fetch clinic plan and AI usage
      const { data: clinic } = await supabase
        .from('clinics')
        .select('subscription_plan, ai_credits_used')
        .eq('id', clinicUser.clinic_id)
        .single()
      
      setClinicData(clinic)

      // Fetch patients
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, full_name')
        .eq('clinic_id', clinicUser.clinic_id)
        .order('full_name')

      if (patientsData) setPatients(patientsData)
    } catch (error) {
      console.error(error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleTag = (tag: string, list: string[], setList: (l: string[]) => void) => {
    if (list.includes(tag)) {
      setList(list.filter(t => t !== tag))
    } else {
      setList([...list, tag])
    }
  }

  const handleGenerate = async () => {
    if (!selectedPatientId) {
      toast.error('Please select a patient')
      return
    }

    // Check credits
    const plan = clinicData?.subscription_plan || 'trial'
    const used = clinicData?.ai_credits_used || 0
    let limit = 999999
    if (plan === 'trial') limit = 5
    else if (plan === 'essentials') limit = 200
    else if (plan === 'growth') limit = 600
    else if (plan === 'scale') limit = 1500

    if (used >= limit) {
      toast.error(`AI credit limit (${limit}) reached for this month. Upgrade your plan for more.`)
      return
    }

    setGenerating(true)
    try {
      const note = await generateSoapNote({
        bodyParts: selectedBodyParts,
        treatments: selectedTreatments,
        painBefore,
        painAfter,
        duration,
        nextSession,
        additionalNotes
      })

      // Parse the generated note into sections
      const sections = {
        subjective: '',
        objective: '',
        assessment: '',
        plan: ''
      }

      const parts = note.split(/(Subjective|Objective|Assessment|Plan):/i)
      for (let i = 1; i < parts.length; i += 2) {
        const title = parts[i].toLowerCase()
        const content = parts[i + 1]?.trim() || ''
        if (title.includes('subjective')) sections.subjective = content
        else if (title.includes('objective')) sections.objective = content
        else if (title.includes('assessment')) sections.assessment = content
        else if (title.includes('plan')) sections.plan = content
      }

      // If parsing fails, put everything in subjective or split by /
      if (!sections.subjective && !sections.objective) {
          const simpleParts = note.split('/')
          sections.subjective = simpleParts[0]?.trim() || ''
          sections.objective = simpleParts[1]?.trim() || ''
          sections.assessment = simpleParts[2]?.trim() || ''
          sections.plan = simpleParts[3]?.trim() || ''
      }

      setGeneratedNote(sections)
      
      // Increment AI usage
      if (clinicData) {
          const used = clinicData.ai_credits_used || 0
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
              const { data: cu } = await supabase.from('clinic_users').select('clinic_id').eq('auth_user_id', user.id).single()
              if (cu) {
                  await supabase.from('clinics').update({ ai_credits_used: used + 1 }).eq('id', cu.clinic_id)
                  setClinicData((prev: any) => ({ ...prev, ai_credits_used: used + 1 }))
              }
          }
      }

    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveNote = async () => {
    if (!generatedNote || !selectedPatientId) return
    setSaving(true)
    try {
      // Find clinic_id
      const { data: { user } } = await supabase.auth.getUser()
      const { data: cu } = await supabase.from('clinic_users').select('clinic_id').eq('auth_user_id', user.id).single()
      
      const { error } = await supabase.from('session_notes').insert([{
        patient_id: selectedPatientId,
        clinic_id: cu.clinic_id,
        note_text: `Subjective: ${generatedNote.subjective}\n\nObjective: ${generatedNote.objective}\n\nAssessment: ${generatedNote.assessment}\n\nPlan: ${generatedNote.plan}`,
        type: 'soap',
        created_at: new Date().toISOString()
      }])

      if (error) throw error
      toast.success('SOAP Note saved successfully')
      setGeneratedNote(null)
      // Reset form?
    } catch (error) {
      console.error(error)
      toast.error('Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  const creditsUsed = clinicData?.ai_credits_used || 0

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary font-bricolage flex items-center gap-2">
              <Sparkles className="w-8 h-8" />
              AI SOAP Notes
            </h1>
            <p className="text-text/60 mt-1">Generate professional clinical notes in seconds using quick tags.</p>
          </div>
          <div className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-2 flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider font-bold text-primary/60">Credits This Month</span>
            <span className="text-xl font-bold text-primary">
              {creditsUsed} / {
                !clinicData?.subscription_plan || clinicData.subscription_plan === 'trial' ? '5' :
                clinicData.subscription_plan === 'essentials' ? '200' :
                clinicData.subscription_plan === 'growth' ? '600' :
                clinicData.subscription_plan === 'scale' ? '1500' : '∞'
              }
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <section className="bg-card border border-border rounded-2xl p-6 card-shadow transition-premium space-y-6">
              {/* Patient Selector */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Select Patient
                </label>
                <select 
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                >
                  <option value="">Choose a patient...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Body Parts Tags */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-text flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Body Part(s)
                </label>
                <div className="flex flex-wrap gap-2">
                  {BODY_PARTS.map(part => (
                    <button
                      key={part}
                      onClick={() => handleToggleTag(part, selectedBodyParts, setSelectedBodyParts)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        selectedBodyParts.includes(part)
                          ? 'bg-primary text-white border-primary shadow-md shadow-primary/20 scale-105'
                          : 'bg-background text-text/60 border-border hover:border-primary/50'
                      }`}
                    >
                      {part}
                    </button>
                  ))}
                </div>
              </div>

              {/* Treatment Tags */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-text flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-primary" />
                  Treatments
                </label>
                <div className="flex flex-wrap gap-2">
                  {TREATMENTS.map(tx => (
                    <button
                      key={tx}
                      onClick={() => handleToggleTag(tx, selectedTreatments, setSelectedTreatments)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        selectedTreatments.includes(tx)
                          ? 'bg-primary text-white border-primary shadow-md shadow-primary/20 scale-105'
                          : 'bg-background text-text/60 border-border hover:border-primary/50'
                      }`}
                    >
                      {tx}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pain Scores & Duration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-text">Pain Before</label>
                    <span className="text-xl font-bold text-primary font-bricolage">{painBefore}/10</span>
                  </div>
                  <input 
                    type="range" min="0" max="10" step="1"
                    value={painBefore} onChange={(e) => setPainBefore(parseInt(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-text">Pain After</label>
                    <span className="text-xl font-bold text-primary font-bricolage">{painAfter}/10</span>
                  </div>
                  <input 
                    type="range" min="0" max="10" step="1"
                    value={painAfter} onChange={(e) => setPainAfter(parseInt(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Duration (mins)
                  </label>
                  <input 
                    type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Next Session
                  </label>
                  <select 
                    value={nextSession} onChange={(e) => setNextSession(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    {NEXT_SESSION_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Free Text */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Anything else to add?
                </label>
                <textarea 
                  value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="e.g. Patient noted improvement in sleep, slight stiffness in morning..."
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none min-h-[100px] resize-none"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating || !selectedPatientId}
                className="w-full bg-primary hover:opacity-90 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-premium shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] btn-premium"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Generating Note...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6" />
                    Generate SOAP Note
                  </>
                )}
              </button>
            </section>
          </div>

          {/* Output Preview */}
          <div className="lg:col-span-5">
            {generatedNote ? (
              <section className="bg-card border-2 border-primary/20 rounded-2xl overflow-hidden card-shadow animate-in fade-in slide-in-from-right-4 duration-300 transition-premium">
                <div className="bg-primary/5 px-6 py-4 border-b border-primary/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <h2 className="font-bold text-primary font-bricolage">Generated Note</h2>
                  </div>
                  <button 
                    onClick={() => setGeneratedNote(null)}
                    className="text-text/40 hover:text-text"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Subjective */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-text/40">Subjective</label>
                    <textarea 
                      value={generatedNote.subjective}
                      onChange={(e) => setGeneratedNote({...generatedNote, subjective: e.target.value})}
                      className="w-full bg-background/50 border border-border rounded-lg p-3 text-sm focus:border-primary outline-none min-h-[80px] leading-relaxed"
                    />
                  </div>
                  {/* Objective */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-text/40">Objective</label>
                    <textarea 
                      value={generatedNote.objective}
                      onChange={(e) => setGeneratedNote({...generatedNote, objective: e.target.value})}
                      className="w-full bg-background/50 border border-border rounded-lg p-3 text-sm focus:border-primary outline-none min-h-[80px] leading-relaxed"
                    />
                  </div>
                  {/* Assessment */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-text/40">Assessment</label>
                    <textarea 
                      value={generatedNote.assessment}
                      onChange={(e) => setGeneratedNote({...generatedNote, assessment: e.target.value})}
                      className="w-full bg-background/50 border border-border rounded-lg p-3 text-sm focus:border-primary outline-none min-h-[80px] leading-relaxed"
                    />
                  </div>
                  {/* Plan */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-text/40">Plan</label>
                    <textarea 
                      value={generatedNote.plan}
                      onChange={(e) => setGeneratedNote({...generatedNote, plan: e.target.value})}
                      className="w-full bg-background/50 border border-border rounded-lg p-3 text-sm focus:border-primary outline-none min-h-[80px] leading-relaxed"
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      onClick={handleSaveNote}
                      disabled={saving}
                      className="flex-1 bg-primary text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-premium active:scale-95 btn-premium"
                    >
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      Save Note
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="px-4 bg-background border border-border text-text hover:bg-accent/10 rounded-xl transition-premium active:scale-95"
                      title="Regenerate"
                    >
                      <RotateCcw className={`w-5 h-5 ${generating ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="mt-4 p-3 bg-amber-50 rounded-lg flex gap-3 border border-amber-100">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-[11px] text-amber-700 leading-tight">
                      AI-generated note. Review and confirm all clinical details before saving to patient record.
                    </p>
                  </div>
                </div>
              </section>
            ) : (
              <div className="h-full min-h-[400px] border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-text/20" />
                </div>
                <div>
                  <h3 className="font-bold text-text/60">No Note Generated Yet</h3>
                  <p className="text-sm text-text/40 mt-1 max-w-[200px]">Fill in the session tags and click generate to see the AI magic.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
