import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { 
  Sparkles, 
  Mic, 
  Square, 
  Upload, 
  FileText, 
  CheckCircle, 
  History,
  Copy, 
  Printer, 
  Mail, 
  MessageSquare, 
  Save,
  Trash2,
  Loader2,
  Clock
} from 'lucide-react'
import { formatLocalTime } from '../lib/date'
import { generateSoapNoteFromAudio } from '../lib/groq'

export const Route = createFileRoute('/ai/soap-notes')({
  component: AISoapNotesPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type Patient = {
  id: string
  full_name: string
}

type SoapNote = {
  s: string
  o: string
  a: string
  p: string
}

type PreviousNote = {
  id: string
  created_at: string
  plan: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ur', name: 'Urdu' },
  { code: 'fr', name: 'French' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ar', name: 'Arabic' },
  { code: 'es', name: 'Spanish' },
]

const QUICK_PHRASES = {
  Subjective: [
    "Patient reports improvement",
    "Pain worse in morning",
    "Pain increased with activity",
    "Patient feeling more mobile",
    "Sharp pain in lower back",
    "ROM feels restricted"
  ],
  Objective: [
    "ROM within normal limits",
    "Muscle strength 4/5",
    "Palpation reveals tenderness",
    "Reduced swelling noted",
    "Gait appears stable",
    "Positive SLR test"
  ]
}

// ─── Components ──────────────────────────────────────────────────────────────

function InstructionBanner() {
  return (
    <div className="bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10 rounded-2xl p-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center gap-2 mb-4 text-primary">
        <Sparkles className="w-5 h-5" />
        <h2 className="font-bold font-bricolage text-lg">How to Use AI SOAP Notes</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        {[
          "Select patient and preferred language",
          "Record audio (max 5 min) OR upload file (max 10 MB)",
          "OR manually select body parts, treatments, and pain scores",
          "Review & edit AI-generated note before saving"
        ].map((step, i) => (
          <div key={i} className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
              {i + 1}
            </span>
            <p className="text-sm text-text/70">{step}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-primary/5 flex items-center gap-2 text-primary/60 text-sm italic">
        <span>💡 Tip: You can edit any section of the generated note manually before saving to patient record.</span>
      </div>
    </div>
  )
}

function PreviousNotesSidebar({ notes, loading, timezone }: { notes: PreviousNote[], loading: boolean, timezone: string }) {
  const country = 'GB'
    return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-text/60 uppercase tracking-widest flex items-center gap-2">
          <History className="w-4 h-4" />
          Previous Notes
        </h3>
      </div>
      
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-background/50 animate-pulse rounded-xl border border-border" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-border rounded-xl text-text/30 text-xs italic">
          No previous notes found for this patient.
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="p-3 bg-white border border-border rounded-xl shadow-sm hover:border-primary/20 transition-all group">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-primary/60">
                  {formatLocalTime(note.created_at, country, 'MMM d, yyyy', timezone)}
                </span>
                <Clock className="w-3 h-3 text-text/20" />
              </div>
              <p className="text-[11px] text-text/60 line-clamp-2 leading-relaxed">
                {note.plan || "No plan recorded."}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function AISoapNotesPage() {
  const navigate = useNavigate()
  const country = 'GB'
  
  // State
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('en')
  const [inputMode, setInputMode] = useState<'ai' | 'manual'>('ai')
  
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [generatedNote, setGeneratedNote] = useState<SoapNote>({ s: '', o: '', a: '', p: '' })
  
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loadingPrevNotes, setLoadingPrevNotes] = useState(false)
  const [previousNotes, setPreviousNotes] = useState<PreviousNote[]>([])
  
  const [credits, setCredits] = useState({ used: 0, limit: 5 })
  const [clinicId, setClinicId] = useState('')
  const [clinicTimezone, setClinicTimezone] = useState<string>('Europe/London')
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialization
  useEffect(() => {
    fetchPatients()
    fetchCredits()
  }, [])

  useEffect(() => {
    if (selectedPatientId) {
      fetchPreviousNotes(selectedPatientId)
    } else {
      setPreviousNotes([])
    }
  }, [selectedPatientId])

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (inputMode === 'ai' && !isGenerating) handleGenerateNote()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (selectedPatientId && !isSaving) handleSaveNote()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [inputMode, isGenerating, isSaving, selectedPatientId, generatedNote, additionalNotes])

  // Data Fetching
  const fetchPatients = async () => {
    const { data } = await supabase
      .from('patients')
      .select('id, full_name')
      .eq('is_deleted', false)
      .order('full_name')
    if (data) setPatients(data)
  }

  const fetchCredits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: cu } = await supabase
        .from('clinic_users').select('clinic_id').eq('auth_user_id', user.id).single()
      if (!cu) return
      setClinicId(cu.clinic_id)

        const { data: clinic } = await supabase
          .from('clinics')
          .select('ai_credits_used, subscription_plan, timezone')
          .eq('id', cu.clinic_id)
          .single()
        
        if (clinic) {
          let limit = 5 // default trial
          const plan = clinic.subscription_plan
          if (plan === 'essentials') limit = 200
          else if (plan === 'growth') limit = 600
          else if (plan === 'scale') limit = 1500
          
          setCredits({ used: clinic.ai_credits_used || 0, limit })
          if (clinic.timezone) setClinicTimezone(clinic.timezone)
        }
    } catch (e) {
      console.error('Error fetching credits:', e)
    }
  }

  const fetchPreviousNotes = async (pId: string) => {
    setLoadingPrevNotes(true)
    try {
      const { data } = await supabase
        .from('session_notes')
        .select('id, created_at, plan')
        .eq('patient_id', pId)
        .order('created_at', { ascending: false })
        .limit(3)
      
      if (data) setPreviousNotes(data)
    } catch (e) {
      console.warn('Could not fetch previous notes. session_notes table might be missing.')
    } finally {
      setLoadingPrevNotes(false)
    }
  }

  // Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : { mimeType: 'audio/webm' }

      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: options.mimeType })
        await transcribeAudioBlob(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      toast.success('Recording started')

      // Auto-stop after 5 minutes
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording()
          toast.warning('Recording stopped automatically after 5 minutes')
        }
      }, 300000)

    } catch (error) {
      console.error('Recording error:', error)
      toast.error('Could not access microphone')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const transcribeAudioBlob = async (audioBlob: Blob) => {
    setIsTranscribing(true)
    try {
      const fileName = `${clinicId}/audio-${Date.now()}.webm`
      const { error: uploadError } = await supabase.storage
        .from('temp-audio')
        .upload(fileName, audioBlob, {
          contentType: audioBlob.type,
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: signedData, error: signedError } = await supabase.storage
        .from('temp-audio')
        .createSignedUrl(fileName, 3600)

      if (signedError || !signedData?.signedUrl) throw signedError || new Error('Failed to generate signed URL')

      const { data, error } = await supabase.functions.invoke('groq-proxy', {
        body: {
          type: 'transcribe',
          audioUrl: signedData.signedUrl,
          language: selectedLanguage
        }
      })

      if (error) throw error

      const transcribedText = data.text || ''
      setAdditionalNotes(prev => prev + (prev ? ' ' : '') + transcribedText)
      toast.success('Audio transcribed successfully')

      await supabase.storage.from('temp-audio').remove([fileName])

      // Auto-generate note if text was received
      if (transcribedText) {
        handleGenerateNote(transcribedText)
      }

    } catch (err: any) {
      console.error('Transcription error:', err)
      toast.error(err.message || 'Failed to transcribe audio')
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      toast.error('Please upload an audio file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Audio file too large. Maximum 10MB allowed.')
      return
    }
    await transcribeAudioBlob(file)
  }

  // Generation Logic
  const handleGenerateNote = async (overrideText?: string) => {
    const textToUse = overrideText || additionalNotes
    if (!textToUse.trim()) {
      toast.error('Please record or enter some notes first')
      return
    }

    if (credits.used >= credits.limit) {
      toast.error('AI Credit limit reached. Please upgrade your plan.')
      return
    }

    setIsGenerating(true)
    try {
      const responseText = await generateSoapNoteFromAudio(textToUse, selectedLanguage)
      
      parseAndSetNote(responseText)
      
      // Update credits in DB (Issue 1)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: cu } = await supabase.from('clinic_users').select('clinic_id').eq('auth_user_id', user.id).single()
        if (cu) {
          await supabase.rpc('increment_ai_credits', { clinic_id_param: cu.clinic_id })
          // Alternatively, if RPC doesn't exist, use regular update:
          await supabase.from('clinics').update({ 
            ai_credits_used: credits.used + 1 
          }).eq('id', cu.clinic_id)
          
          fetchCredits() // Refetch to ensure accuracy
        }
      }

      toast.success('SOAP note generated!')
      
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate note')
    } finally {
      setIsGenerating(false)
    }
  }

  // Improved Parsing Logic (Issue 3)
  const parseAndSetNote = (responseText: string) => {
    console.log('Raw AI Response:', responseText)
    
    const sections: SoapNote = { s: '', o: '', a: '', p: '' }
    
    // 1. Try regex matching for clear headers
    const sMatch = responseText.match(/Subjective[:\s]+(.*?)(?=Objective|$)/is)
    const oMatch = responseText.match(/Objective[:\s]+(.*?)(?=Assessment|$)/is)
    const aMatch = responseText.match(/Assessment[:\s]+(.*?)(?=Plan|$)/is)
    const pMatch = responseText.match(/Plan[:\s]+(.*?)$/is)

    if (sMatch) sections.s = sMatch[1].trim()
    if (oMatch) sections.o = oMatch[1].trim()
    if (aMatch) sections.a = aMatch[1].trim()
    if (pMatch) sections.p = pMatch[1].trim()

    // 2. Fallback to numbered format or basic headers if regex fails
    if (!sections.s && !sections.o && !sections.a && !sections.p) {
      const lines = responseText.split('\n')
      let currentSection: keyof SoapNote | null = null
      
      lines.forEach(line => {
        const lowerLine = line.toLowerCase().trim()
        if (lowerLine.startsWith('subjective') || lowerLine.startsWith('s:')) currentSection = 's'
        else if (lowerLine.startsWith('objective') || lowerLine.startsWith('o:')) currentSection = 'o'
        else if (lowerLine.startsWith('assessment') || lowerLine.startsWith('a:')) currentSection = 'a'
        else if (lowerLine.startsWith('plan') || lowerLine.startsWith('p:')) currentSection = 'p'
        else if (currentSection) {
          sections[currentSection] += (sections[currentSection] ? '\n' : '') + line
        }
      })
    }

    if (!sections.s && !sections.o && !sections.a && !sections.p) {
      sections.s = responseText
      toast.warning("Note generated but formatting unclear. Please review and edit sections manually.")
    }

    setGeneratedNote(sections)
  }

  // Save Logic
  const handleSaveNote = async () => {
    console.log('Attempting to save note for patient:', selectedPatientId)
    
    if (!selectedPatientId) {
      toast.error('Please select a patient first')
      return
    }
    
    setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Authentication failed: No user found')
      console.log('User authenticated:', user.id)
      
      const { data: cu, error: cuError } = await supabase
        .from('clinic_users').select('clinic_id').eq('auth_user_id', user.id).single()
      
      if (cuError || !cu) {
        console.error('Clinic lookup error:', cuError)
        throw new Error('Clinic context not found. Please re-login.')
      }
      console.log('Clinic found:', cu.clinic_id)

      // Find the latest booking
      const { data: latestBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('patient_id', selectedPatientId)
        .order('start_time', { ascending: false })
        .limit(1)
        .single()
      
      console.log('Linking to booking:', latestBooking?.id || 'None found')

      const fullNoteText = `Subjective (S): ${generatedNote.s}\nObjective (O): ${generatedNote.o}\nAssessment (A): ${generatedNote.a}\nPlan (P): ${generatedNote.p}`

      const payload = {
        patient_id: selectedPatientId,
        clinic_id: cu.clinic_id,
        booking_id: latestBooking?.id || null,
        s: generatedNote.s,
        o: generatedNote.o,
        a: generatedNote.a,
        p: generatedNote.p,
        note_text: fullNoteText,
        type: 'soap',
        full_content: JSON.stringify(generatedNote),
        plan: generatedNote.p.substring(0, 500),
        created_at: new Date().toISOString()
      }

      console.log('Saving payload:', payload)

      const { data: savedData, error: saveError } = await supabase
        .from('session_notes')
        .insert([payload])
        .select()
      
      if (saveError) {
        console.error('Database save error:', saveError)
        throw new Error(`DB Error: ${saveError.message}`)
      }

      console.log('Save successful:', savedData)
      toast.success('Note saved to patient history', {
        action: {
          label: 'View Profile',
          onClick: () => navigate({ 
            to: '/patients/$patientId', 
            params: { country, patientId: selectedPatientId } as any 
          })
        }
      })
      
      // Clear form logic
      const shouldClear = confirm("Note saved. Would you like to clear the form to start another note?")
      if (shouldClear) {
        setGeneratedNote({ s: '', o: '', a: '', p: '' })
        setAdditionalNotes('')
        setSelectedPatientId('')
      }

      fetchPreviousNotes(selectedPatientId)
      
    } catch (e: any) {
      console.error('Save flow caught error:', e)
      toast.error(`Save failed: ${e.message || 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Export Logic
  const copyToClipboard = () => {
    const text = `S: ${generatedNote.s}\nO: ${generatedNote.o}\nA: ${generatedNote.a}\nP: ${generatedNote.p}`
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const printNote = () => {
    window.print()
  }

  const emailNote = () => {
    const subject = `SOAP Note - ${formatLocalTime(new Date().toISOString(), country, 'MMM d, yyyy', clinicTimezone)}`
    const body = `Subjective (S): ${generatedNote.s}\n\nObjective (O): ${generatedNote.o}\n\nAssessment (A): ${generatedNote.a}\n\nPlan (P): ${generatedNote.p}`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const handlePhraseClick = (phrase: string) => {
    setAdditionalNotes(prev => prev + (prev ? ' ' : '') + phrase)
  }

  const inputClass = "w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white"

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto pb-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[28px] font-bold text-primary font-bricolage leading-tight flex items-center gap-2">
              <Sparkles className="w-7 h-7" />
              AI SOAP Notes
            </h1>
            <p className="text-text/50 text-sm mt-1">Generate professional clinical documentation in seconds.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-white border border-border rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-text/40 uppercase tracking-widest">AI Credits</span>
                <span className="text-sm font-bold text-text">{credits.used} / {credits.limit} Used</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Instruction Banner */}
        <InstructionBanner />

        {/* Section 2: Patient & Mode Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div>
                  <label className="block text-xs font-bold text-text/40 uppercase tracking-widest mb-2">Select Patient</label>
                  <select 
                    value={selectedPatientId} 
                    onChange={e => setSelectedPatientId(e.target.value)}
                    className={inputClass}
                    aria-label="Select patient"
                  >
                    <option value="">Select a patient...</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text/40 uppercase tracking-widest mb-2">Documentation Language</label>
                  <select 
                    value={selectedLanguage} 
                    onChange={e => setSelectedLanguage(e.target.value)}
                    className={inputClass}
                    aria-label="Select language"
                  >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="flex justify-center mb-8">
                <div className="bg-background/80 border border-border p-1 rounded-full inline-flex">
                  <button 
                    onClick={() => setInputMode('ai')}
                    className={`px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${inputMode === 'ai' ? 'bg-primary text-white shadow-lg' : 'text-text/60 hover:text-text'}`}
                    aria-label="Switch to AI Assisted mode"
                  >
                    <Sparkles className={`w-4 h-4 ${inputMode === 'ai' ? 'animate-pulse' : ''}`} />
                    AI Assisted
                  </button>
                  <button 
                    onClick={() => setInputMode('manual')}
                    className={`px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${inputMode === 'manual' ? 'bg-primary text-white shadow-lg' : 'text-text/60 hover:text-text'}`}
                    aria-label="Switch to Manual Entry mode"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Manual Entry
                  </button>
                </div>
              </div>

              {/* AI Mode Content */}
              {inputMode === 'ai' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button 
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`h-32 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 transition-all ${isRecording ? 'border-alert bg-alert/5 text-alert animate-pulse' : 'border-dashed border-border hover:border-primary/30 hover:bg-primary/5 text-text/50'}`}
                      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                    >
                      {isRecording ? <Square className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                      <span className="text-sm font-bold">{isRecording ? 'Recording... (Click to stop)' : 'Record Session Audio'}</span>
                    </button>
                    
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="h-32 rounded-2xl border-2 border-dashed border-border hover:border-primary/30 hover:bg-primary/5 text-text/50 flex flex-col items-center justify-center gap-3 transition-all"
                      aria-label="Upload audio file"
                    >
                      <Upload className="w-8 h-8" />
                      <span className="text-sm font-bold">Upload Audio File (Max 10MB)</span>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleAudioFileUpload} 
                        className="hidden" 
                        accept="audio/*" 
                      />
                    </button>
                  </div>

                  {/* Transcribing Indicator */}
                  {isTranscribing && (
                    <div className="flex items-center justify-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10 text-primary">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-bold">Transcribing audio...</span>
                    </div>
                  )}

                  {/* Quick Phrases */}
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(QUICK_PHRASES).map(([cat, phrases]) => (
                        <div key={cat} className="flex flex-wrap gap-2 items-center">
                          <span className="text-[10px] font-bold text-text/30 uppercase tracking-widest mr-1">{cat}:</span>
                          {phrases.slice(0, 3).map(phrase => (
                            <button 
                              key={phrase} 
                              onClick={() => handlePhraseClick(phrase)}
                              className="px-3 py-1.5 bg-background border border-border rounded-full text-xs font-medium text-text/60 hover:border-primary/30 hover:text-primary transition-all"
                            >
                              {phrase}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-text/40 uppercase tracking-widest mb-2">Additional Notes / Transcript</label>
                      <textarea 
                        value={additionalNotes}
                        onChange={e => setAdditionalNotes(e.target.value)}
                        className={`${inputClass} min-height-[150px] resize-none`}
                        placeholder="Transcription will appear here. You can also type manually..."
                        rows={6}
                        aria-label="Additional notes or transcript"
                      />
                    </div>

                    <button 
                      onClick={() => handleGenerateNote()}
                      disabled={isGenerating || !additionalNotes.trim()}
                      className="w-full btn-premium bg-primary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 disabled:shadow-none transition-all group"
                      aria-label="Generate SOAP Note"
                    >
                      {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                      {isGenerating ? 'Generating Note...' : 'Generate AI SOAP Note'}
                      <span className="text-[10px] opacity-60 ml-2 px-1.5 py-0.5 border border-white/20 rounded">Ctrl + Enter</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Manual Mode Content */}
              {inputMode === 'manual' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {[
                    { key: 's', label: 'Subjective (S)', placeholder: 'Patient reports... symptoms, pain levels, history' },
                    { key: 'o', label: 'Objective (O)', placeholder: 'Clinical findings... ROM, tests, observations' },
                    { key: 'a', label: 'Assessment (A)', placeholder: 'Clinical reasoning... diagnosis, progress' },
                    { key: 'p', label: 'Plan (P)', placeholder: 'Treatment plan... exercises, next steps' }
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-bold text-text/40 uppercase tracking-widest mb-2">{field.label}</label>
                      <textarea 
                        value={generatedNote[field.key as keyof SoapNote]}
                        onChange={e => setGeneratedNote({ ...generatedNote, [field.key]: e.target.value })}
                        className={`${inputClass} min-h-[100px] resize-none`}
                        placeholder={field.placeholder}
                        aria-label={field.label}
                      />
                    </div>
                  ))}
                  
                  <button 
                    onClick={handleSaveNote}
                    disabled={isSaving || !selectedPatientId}
                    className="w-full btn-premium bg-primary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all"
                    aria-label="Save SOAP Note"
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Manual SOAP Note
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Output & Previous Notes */}
          <div className="space-y-6">
            
            {/* Previous Notes Section */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <PreviousNotesSidebar notes={previousNotes} loading={loadingPrevNotes} timezone={clinicTimezone} />
            </div>

            {/* Generated Output Card */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden sticky top-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="p-5 border-b border-border bg-background/50 flex items-center justify-between">
                <h3 className="font-bold text-primary font-bricolage flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Generated Note
                </h3>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={copyToClipboard}
                    className="p-2 hover:bg-primary/5 text-text/50 hover:text-primary rounded-lg transition-all"
                    title="Copy to Clipboard"
                    aria-label="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={printNote}
                    className="p-2 hover:bg-primary/5 text-text/50 hover:text-primary rounded-lg transition-all"
                    title="Print"
                    aria-label="Print note"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={emailNote}
                    className="p-2 hover:bg-primary/5 text-text/50 hover:text-primary rounded-lg transition-all"
                    title="Email"
                    aria-label="Email note"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => { setGeneratedNote({ s: '', o: '', a: '', p: '' }); setAdditionalNotes(''); }}
                    className="p-2 hover:bg-alert/5 text-text/50 hover:text-alert rounded-lg transition-all ml-1"
                    title="Clear All"
                    aria-label="Clear all content"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5 max-h-[600px] overflow-y-auto">
                {Object.entries(generatedNote).every(([_, val]) => !val) ? (
                  <div className="py-12 text-center text-text/20 flex flex-col items-center">
                    <Sparkles className="w-12 h-12 mb-4 opacity-10" />
                    <p className="text-sm">Note output will appear here after generation.</p>
                  </div>
                ) : (
                  <>
                    {[
                      { key: 's', label: 'Subjective (S)', color: 'bg-blue-50/30' },
                      { key: 'o', label: 'Objective (O)', color: 'bg-green-50/30' },
                      { key: 'a', label: 'Assessment (A)', color: 'bg-purple-50/30' },
                      { key: 'p', label: 'Plan (P)', color: 'bg-orange-50/30' }
                    ].map(field => (
                      <div key={field.key} className={`space-y-2 p-3 rounded-xl border border-border/50 ${field.color}`}>
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-bold text-text/30 uppercase tracking-widest">{field.label}</h4>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(generatedNote[field.key as keyof SoapNote])
                              toast.success(`Copied ${field.label} section`)
                            }}
                            className="p-1.5 hover:bg-white/50 text-text/30 hover:text-primary rounded-md transition-all"
                            title={`Copy ${field.label}`}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <textarea 
                          value={generatedNote[field.key as keyof SoapNote]}
                          onChange={e => setGeneratedNote({ ...generatedNote, [field.key]: e.target.value })}
                          className="w-full p-2 bg-transparent border-none text-sm leading-relaxed text-text outline-none transition-all resize-none min-h-[60px]"
                          rows={Math.max(2, (generatedNote[field.key as keyof SoapNote] || '').split('\n').length)}
                          aria-label={`Edit ${field.label}`}
                        />
                      </div>
                    ))}
                    
                    <div className="pt-4 border-t border-border mt-6">
                      <button 
                        onClick={handleSaveNote}
                        disabled={isSaving || !selectedPatientId}
                        className="w-full btn-premium bg-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all"
                        aria-label="Save generated note to patient record"
                      >
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        Save to Patient Record
                        <span className="text-[10px] opacity-60 ml-2 px-1.5 py-0.5 border border-white/20 rounded">Ctrl + S</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}