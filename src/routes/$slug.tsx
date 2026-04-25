import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Check, AlertCircle, X } from 'lucide-react'

export const Route = createFileRoute('/$slug')({
  component: BookingPage,
})

// ─── Shared Types & Helpers ───────────────────────────────────────────────────

type Dot = {
  id: string
  x: number
  y: number
  side: 'front' | 'back'
  score: number
  regionId: string
  regionName: string
}

function calculateAge(dob: string) {
  if (!dob) return 999
  const birth = new Date(dob)
  const diff = Date.now() - birth.getTime()
  return new Date(diff).getUTCFullYear() - 1970
}

function getScoreColor(score: number) {
  if (score <= 3) return '#D9B29C'
  if (score <= 6) return '#F5A623'
  return '#C0392B'
}

function getRegionInfo(y: number, side: 'front' | 'back') {
  if (y < 25) return side === 'front' ? { id: 'head_neck', name: 'Head/Neck' } : { id: 'back_head', name: 'Back of Head' }
  if (y < 45) return side === 'front' ? { id: 'chest', name: 'Chest' } : { id: 'upper_back', name: 'Upper Back' }
  if (y < 60) return side === 'front' ? { id: 'abdomen', name: 'Abdomen' } : { id: 'lower_back', name: 'Lower Back' }
  return side === 'front' ? { id: 'legs_front', name: 'Legs (Front)' } : { id: 'legs_back', name: 'Legs (Back)' }
}



function getFaceForScore(score: number) {
  if (score <= 2) return '😊'
  if (score <= 4) return '🙂'
  if (score <= 6) return '😐'
  if (score <= 8) return '😟'
  return '😣'
}

const COUNTRY_CODES = [
  { flag: '🇬🇧', code: '+44', name: 'United Kingdom' },
  { flag: '🇦🇺', code: '+61', name: 'Australia' },
  { flag: '🇩🇪', code: '+49', name: 'Germany' },
  { flag: '🇫🇷', code: '+33', name: 'France' },
  { flag: '🇳🇱', code: '+31', name: 'Netherlands' },
  { flag: '🇵🇰', code: '+92', name: 'Pakistan' },
  { flag: '🌍', code: '+', name: 'Other' }
]

// ─── Body Map Component ───────────────────────────────────────────────────────

function BodySVG() {
  return (
    <svg viewBox="0 0 100 200" className="w-full h-auto drop-shadow-sm">
      {/* Head */}
      <circle cx="50" cy="20" r="14" fill="#f8f9fa" stroke="#cbd5e1" strokeWidth="2" />
      {/* Torso */}
      <rect x="36" y="34" width="28" height="56" rx="8" fill="#f8f9fa" stroke="#cbd5e1" strokeWidth="2" />
      {/* Arms */}
      <line x1="36" y1="42" x2="18" y2="85" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
      <line x1="64" y1="42" x2="82" y2="85" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
      {/* Legs */}
      <line x1="42" y1="90" x2="36" y2="165" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />
      <line x1="58" y1="90" x2="64" y2="165" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />
    </svg>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function BookingPage() {
  const { slug } = Route.useParams()
  const [loading, setLoading] = useState(true)
  const [clinic, setClinic] = useState<any>(null)
  
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1: Details
  const [fullName, setFullName] = useState('')
  const [whatsappCode, setWhatsappCode] = useState('+44')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [dob, setDob] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianWhatsappCode, setGuardianWhatsappCode] = useState('+44')
  const [guardianWhatsapp, setGuardianWhatsapp] = useState('')

  // Step 2: Where does it hurt?
  const [dots, setDots] = useState<Dot[]>([])
  const [pendingDot, setPendingDot] = useState<{ x: number, y: number, side: 'front'|'back', regionId: string, regionName: string } | null>(null)

  // Step 3: Medical background
  const [surgeries, setSurgeries] = useState('')
  const [conditions, setConditions] = useState('')
  const [medications, setMedications] = useState('')
  const [allergies, setAllergies] = useState('')
  const [occupation, setOccupation] = useState('')

  // Step 4: Safety questions
  const [q1, setQ1] = useState<string | null>(null)
  const [q2, setQ2] = useState<string | null>(null)
  const [q3, setQ3] = useState<string | null>(null)
  const [q4, setQ4] = useState<string | null>(null)

  // Step 5: Consent
  const [consent1, setConsent1] = useState(false)
  const [consent2, setConsent2] = useState(false)
  const [consent3, setConsent3] = useState(false)
  const [honeypot, setHoneypot] = useState('')

  // OTP
  const [otpCode, setOtpCode] = useState('')
  const [generatedOtp, setGeneratedOtp] = useState('')

  useEffect(() => {
    fetchClinic()
  }, [])

  const fetchClinic = async () => {
    console.log("slug from URL:", slug)
    console.log("fetching clinic...")
    try {
      const { data: clinic, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()
      
      console.log("clinic data:", clinic)
      console.log("error:", error)

      if (clinic) setClinic(clinic)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleBodyClick = (e: React.MouseEvent<HTMLDivElement>, side: 'front' | 'back') => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const { id, name } = getRegionInfo(y, side)
    setPendingDot({ x, y, side, regionId: id, regionName: name })
  }

  const saveDot = (score: number) => {
    if (!pendingDot) return
    // Remove existing dot in same region if exists
    const newDots = dots.filter(d => d.regionId !== pendingDot.regionId)
    setDots([...newDots, {
      id: Math.random().toString(36).substring(7),
      x: pendingDot.x,
      y: pendingDot.y,
      side: pendingDot.side,
      score,
      regionId: pendingDot.regionId,
      regionName: pendingDot.regionName
    }])
    setPendingDot(null)
  }

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log("Confirm booking clicked")
    console.log("form data:", { fullName, whatsapp, dob, clinicId: clinic?.id, consent1, honeypot })

    if (honeypot) {
      console.log("Honeypot blocked submission")
      return // reject silently
    }

    setSaving(true)
    try {
      const fullWhatsapp = `${whatsappCode}${whatsapp.trim()}`
      const fullGuardianWhatsapp = isMinor ? `${guardianWhatsappCode}${guardianWhatsapp.trim()}` : null

      // 1. Check duplicate patient
      const { data: existing, error: existingErr } = await supabase
        .from('patients')
        .select('id')
        .eq('phone_number', fullWhatsapp)
        .eq('clinic_id', clinic.id)
        .maybeSingle()
        
      if (existingErr) throw existingErr

      if (existing) {
        toast.info("We already have your details. Your booking request has been received. Your physio will confirm shortly.", { duration: 6000 })
        setStep(7)
        setSaving(false)
        return
      }

      // 2. Insert new patient
      const { data: patient, error: patientErr } = await supabase.from('patients').insert({
        clinic_id: clinic.id,
        full_name: fullName,
        phone_number: fullWhatsapp,
        email: email || null,
        date_of_birth: dob,
        gdpr_consent: true,
        consent_date: new Date().toISOString(),
        status_tag: 'active',
        primary_complaint: 'Online Booking',
        referral_source: 'Online Booking',
        guardian_name: isMinor ? guardianName : null,
        guardian_whatsapp: fullGuardianWhatsapp,
      }).select().single()

      console.log("patient insert result:", patient, patientErr)
      if (patientErr || !patient) throw patientErr

      // 3. Format JSONs
      const painData = dots.reduce((acc, d) => ({ ...acc, [d.regionId]: d.score }), {})
      const redFlags = {
        weight_loss: q1,
        bladder_bowel: q2,
        numbness: q3,
        chest_pain: q4
      }
      const notes = `Surgeries: ${surgeries || 'none'} | Conditions: ${conditions || 'none'} | Meds: ${medications || 'none'} | Allergies: ${allergies || 'none'} | Occupation: ${occupation || 'none'}`

      // 4. Insert Booking
      const { data: bookingData, error: bookingErr } = await supabase.from('bookings').insert({
        clinic_id: clinic.id,
        patient_id: patient.id,
        pain_data: painData,
        red_flags: redFlags,
        status: 'upcoming',
        appointment_type: 'initial',
        notes: notes
      }).select().single()
      
      console.log("booking insert result:", bookingData, bookingErr)
      if (bookingErr) throw bookingErr

      // 5. Insert Consents
      const consents = [
        { patient_id: patient.id, consent_type: 'data_processing', granted: consent1 },
        { patient_id: patient.id, consent_type: 'whatsapp_reminders', granted: consent2 },
        { patient_id: patient.id, consent_type: 'marketing', granted: consent3 },
      ]
      const { error: consentErr } = await supabase.from('consent_records').insert(consents)
      if (consentErr) throw consentErr

      // 6. Generate OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const { error: otpErr } = await supabase.from('otp_codes').insert({
        phone_number: fullWhatsapp,
        code
      })
      if (otpErr) throw otpErr
      
      setGeneratedOtp(code)
      console.log('OTP CODE:', code)
      toast.success(`[TEST MODE] OTP Code is: ${code}`, { duration: 8000 })
      
      setStep(6)
    } catch (err: any) {
      console.error("Booking Error:", err)
      toast.error(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const verifyOtp = async () => {
    if (otpCode === generatedOtp) {
      setStep(7)
    } else {
      toast.error('Invalid OTP code')
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-[#EDF6F9] flex items-center justify-center font-medium text-gray-500">Loading...</div>
  }

  if (!clinic) {
    return (
      <div className="min-h-screen bg-[#EDF6F9] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-lg">
          <AlertCircle className="w-12 h-12 text-[#C0392B] mx-auto mb-4 opacity-80" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Clinic Not Found</h2>
          <p className="text-gray-500">We couldn't find a clinic with this link. Please check the URL and try again.</p>
        </div>
      </div>
    )
  }

  if (clinic.booking_page_mode === 'closed') {
    return (
      <div className="min-h-screen bg-[#EDF6F9] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-lg">
          <AlertCircle className="w-12 h-12 text-[#C0392B] mx-auto mb-4 opacity-80" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Bookings Unavailable</h2>
          <p className="text-gray-500">This clinic is not accepting online bookings. Please contact your physiotherapist directly.</p>
        </div>
      </div>
    )
  }

  const brandColor = clinic.brand_color || '#006D77'
  const isMinor = calculateAge(dob) < 16

  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 outline-none text-sm bg-gray-50 transition-colors"
  const labelClass = "block text-sm font-semibold text-gray-800 mb-1.5"

  return (
    <div className="min-h-screen bg-[#EDF6F9] py-12 px-4 sm:px-6 font-sans">
      <div className="max-w-[560px] mx-auto">
        
        {/* HEADER */}
        {step < 6 && (
          <div className="text-center mb-8">
            {clinic.logo_url && (
              <img src={clinic.logo_url} alt={clinic.name} className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4 shadow-sm border border-gray-100" />
            )}
            <h1 className="text-2xl font-bold mb-2" style={{ color: brandColor }}>{clinic.name}</h1>
            {clinic.bio && <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4 leading-relaxed">{clinic.bio}</p>}
            
            <div className="flex items-center justify-center gap-4 mt-6 mb-2">
              <div className="h-2 flex-1 rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full transition-all duration-500 ease-out" style={{ width: `${(step / 5) * 100}%`, backgroundColor: brandColor }} />
              </div>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Step {step} of 5</p>
          </div>
        )}

        {/* CARD CONTENT */}
        <div className="bg-white rounded-2xl p-6 sm:p-10 shadow-lg border border-gray-100 relative overflow-hidden">
          
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Your details</h2>
              
              <div>
                <label className={labelClass}>Full name *</label>
                <input required type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} style={{ outlineColor: brandColor }} />
              </div>
              
              <div>
                <label className={labelClass}>WhatsApp number *</label>
                <div className="flex w-full rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 bg-gray-50 transition-colors" style={{ outlineColor: brandColor }}>
                  <select 
                    value={whatsappCode} 
                    onChange={e => setWhatsappCode(e.target.value)}
                    className="w-[120px] px-3 py-3 bg-transparent border-r border-gray-200 outline-none text-sm text-gray-700 cursor-pointer appearance-none"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.name} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <input 
                    required type="tel" value={whatsapp} 
                    onChange={e => setWhatsapp(e.target.value)} 
                    placeholder="7700 900000" 
                    className="flex-1 px-4 py-3 bg-transparent outline-none text-sm" 
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Email (optional)</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} style={{ outlineColor: brandColor }} />
              </div>

              <div>
                <label className={labelClass}>Date of birth *</label>
                <input required type="date" value={dob} onChange={e => setDob(e.target.value)} className={inputClass} style={{ outlineColor: brandColor }} />
              </div>

              {isMinor && (
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl space-y-4 mt-4">
                  <p className="text-xs font-semibold text-orange-800 uppercase tracking-wider">Guardian Details Required</p>
                  <div>
                    <label className={labelClass}>Guardian full name *</label>
                    <input required type="text" value={guardianName} onChange={e => setGuardianName(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Guardian WhatsApp *</label>
                    <div className="flex w-full rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 bg-gray-50 transition-colors bg-white">
                      <select 
                        value={guardianWhatsappCode} 
                        onChange={e => setGuardianWhatsappCode(e.target.value)}
                        className="w-[120px] px-3 py-3 bg-transparent border-r border-gray-200 outline-none text-sm text-gray-700 cursor-pointer appearance-none"
                      >
                        {COUNTRY_CODES.map(c => (
                          <option key={c.name} value={c.code}>{c.flag} {c.code}</option>
                        ))}
                      </select>
                      <input 
                        required type="tel" value={guardianWhatsapp} 
                        onChange={e => setGuardianWhatsapp(e.target.value)} 
                        placeholder="7700 900000" 
                        className="flex-1 px-4 py-3 bg-transparent outline-none text-sm" 
                      />
                    </div>
                  </div>
                </div>
              )}

              <button onClick={() => {
                if (!fullName || !whatsapp || !dob || (isMinor && (!guardianName || !guardianWhatsapp))) {
                  toast.error('Please fill all required fields'); return;
                }
                setStep(2)
              }} className="w-full text-white font-bold py-3.5 rounded-xl transition-transform active:scale-95 mt-6" style={{ backgroundColor: brandColor }}>
                Next →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Where does it hurt?</h2>
              <p className="text-sm text-gray-500 italic text-center mb-6">Tap where it hurts.<br/>Rate the pain 1–10.</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Front</p>
                  <div className="relative inline-block w-full max-w-[160px] mx-auto cursor-pointer" onClick={e => handleBodyClick(e, 'front')}>
                    <BodySVG />
                    {dots.filter(d => d.side === 'front').map(d => (
                      <div key={d.id} className="absolute w-5 h-5 rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[10px] text-white font-bold"
                           style={{ left: `${d.x}%`, top: `${d.y}%`, backgroundColor: getScoreColor(d.score) }}
                           onClick={e => { e.stopPropagation(); setDots(dots.filter(dot => dot.id !== d.id)) }}>
                        {d.score}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Back</p>
                  <div className="relative inline-block w-full max-w-[160px] mx-auto cursor-pointer" onClick={e => handleBodyClick(e, 'back')}>
                    <BodySVG />
                    {dots.filter(d => d.side === 'back').map(d => (
                      <div key={d.id} className="absolute w-5 h-5 rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[10px] text-white font-bold"
                           style={{ left: `${d.x}%`, top: `${d.y}%`, backgroundColor: getScoreColor(d.score) }}
                           onClick={e => { e.stopPropagation(); setDots(dots.filter(dot => dot.id !== d.id)) }}>
                        {d.score}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {dots.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  {dots.map(d => (
                    <div key={d.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-sm transition-transform hover:scale-105"
                         style={{ backgroundColor: getScoreColor(d.score) }}>
                      {d.regionName} • {d.score}/10
                      <button onClick={() => setDots(dots.filter(dot => dot.id !== d.id))} className="ml-1 opacity-70 hover:opacity-100">
                        <X size={12} strokeWidth={3} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {pendingDot && (
                <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                  <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl relative animate-in zoom-in-95 duration-200">
                    <button onClick={() => setPendingDot(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                      <X size={20} />
                    </button>
                    
                    <p className="font-bold text-gray-900 mb-1">{pendingDot.regionName}</p>
                    <p className="text-sm text-gray-500 mb-4">Rate the pain level (1-10)</p>
                    
                    <div className="flex gap-1 overflow-x-auto pb-2 justify-between">
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <button key={n} onClick={() => saveDot(n)}
                          className="flex flex-col items-center gap-1.5 min-w-[36px] p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                          <span className="text-xl">{getFaceForScore(n)}</span>
                          <span className="w-7 h-7 rounded-full text-[11px] flex items-center justify-center font-bold text-white shadow-sm"
                                style={{ backgroundColor: getScoreColor(n) }}>
                            {n}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex flex-col gap-3">
                <button onClick={() => setStep(3)} className="w-full text-white font-bold py-3.5 rounded-xl transition-transform active:scale-95" style={{ backgroundColor: brandColor }}>
                  Next →
                </button>
                <button onClick={() => setStep(3)} className="text-gray-400 text-sm font-medium hover:text-gray-600">Skip this step</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Medical background</h2>
              <p className="text-sm text-gray-500 mb-6">This helps your physio prepare. Skip anything you prefer not to share.</p>

              {[
                { label: 'Any past surgeries?', val: surgeries, set: setSurgeries },
                { label: 'Any ongoing conditions?', val: conditions, set: setConditions },
                { label: 'Current medications?', val: medications, set: setMedications },
                { label: 'Any allergies?', val: allergies, set: setAllergies },
                { label: 'Occupation?', val: occupation, set: setOccupation },
              ].map(field => (
                <div key={field.label}>
                  <label className={labelClass}>{field.label}</label>
                  <input type="text" value={field.val} onChange={e => field.set(e.target.value)} placeholder="Prefer not to say" className={inputClass} style={{ outlineColor: brandColor }} />
                </div>
              ))}

              <div className="pt-4 flex flex-col gap-3">
                <button onClick={() => setStep(4)} className="w-full text-white font-bold py-3.5 rounded-xl transition-transform active:scale-95 mt-4" style={{ backgroundColor: brandColor }}>
                  Next →
                </button>
                <button onClick={() => setStep(4)} className="text-gray-400 text-sm font-medium hover:text-gray-600">Skip this step</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Safety questions</h2>
              <p className="text-sm text-gray-500 mb-6">A few quick yes/no questions for your safety.</p>

              {[
                { id: 'q1', text: 'Any unexplained weight loss recently?', val: q1, set: setQ1 },
                { id: 'q2', text: 'Any bladder or bowel changes?', val: q2, set: setQ2 },
                { id: 'q3', text: 'Any numbness or tingling in limbs?', val: q3, set: setQ3 },
                { id: 'q4', text: 'Any chest pain or breathlessness?', val: q4, set: setQ4 },
              ].map(q => (
                <div key={q.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-sm font-semibold text-gray-800 mb-3">{q.text}</p>
                  <div className="flex gap-2">
                    {['Yes', 'No', 'Unsure'].map(opt => (
                      <button key={opt} onClick={() => q.set(opt)} className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${
                        q.val === opt ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`} style={{ backgroundColor: q.val === opt ? brandColor : undefined }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                  {q.val === 'Yes' && (
                    <p className="text-xs text-orange-600 mt-3 font-medium bg-orange-50 p-2 rounded flex items-center gap-2">
                      <AlertCircle size={14} /> Your physiotherapist will follow up on this in your session.
                    </p>
                  )}
                </div>
              ))}

              <button onClick={() => setStep(5)} className="w-full text-white font-bold py-3.5 rounded-xl transition-transform active:scale-95 mt-4" style={{ backgroundColor: brandColor }}>
                Next →
              </button>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Consent</h2>

              <form onSubmit={submitBooking} className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input required type="checkbox" checked={consent1} onChange={e => setConsent1(e.target.checked)} className="mt-1 w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded" />
                  <span className="text-sm text-gray-700">I agree to my personal data being stored for appointment management and clinical care <span className="text-red-500">*</span></span>
                </label>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" checked={consent2} onChange={e => setConsent2(e.target.checked)} className="mt-1 w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded" />
                    <span className="text-sm text-gray-700">I agree to receive WhatsApp reminders about my appointments</span>
                  </label>
                  
                  {!consent2 && (
                    <div className="p-3 rounded-lg flex items-start gap-2 ml-7" style={{ backgroundColor: '#FFF8E6', border: '1px solid #F5A623', color: '#854F0B' }}>
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p className="text-sm font-medium leading-tight">
                        Without WhatsApp consent, you won't receive appointment confirmations or follow-up messages from your clinic.
                      </p>
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={consent3} onChange={e => setConsent3(e.target.checked)} className="mt-1 w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded" />
                  <span className="text-sm text-gray-700">I agree to receive occasional health tips and clinic updates</span>
                </label>

                <p className="text-xs text-gray-400 underline cursor-pointer mt-4 hover:text-gray-600">Privacy Notice</p>

                <input type="text" name="website" value={honeypot} onChange={e => setHoneypot(e.target.value)} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

                <button disabled={!consent1 || saving} type="submit" className="w-full text-white font-bold py-3.5 rounded-xl transition-transform active:scale-95 mt-8 disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: brandColor }}>
                  {saving ? 'Processing...' : 'Confirm Booking'}
                </button>
              </form>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-300 py-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify your number</h2>
              <p className="text-sm text-gray-500 mb-6 max-w-[280px] mx-auto">We sent a 6-digit code to <strong className="text-gray-800">{whatsapp}</strong>. Enter it below to confirm your booking.</p>

              <input type="text" maxLength={6} value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="w-48 text-center text-3xl tracking-[0.25em] font-bold py-4 rounded-xl border-2 border-gray-200 focus:border-primary outline-none bg-gray-50 mx-auto block" style={{ outlineColor: brandColor }} />

              <button onClick={verifyOtp} disabled={otpCode.length !== 6} className="w-full text-white font-bold py-3.5 rounded-xl transition-transform active:scale-95 mt-6 disabled:opacity-50" style={{ backgroundColor: brandColor }}>
                Verify
              </button>

              <p className="text-sm text-gray-400 mt-4 cursor-pointer hover:text-gray-600">Resend code</p>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-500 py-8">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto bg-green-50">
                <Check className="w-10 h-10 text-green-500" strokeWidth={3} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
                <p className="font-semibold" style={{ color: brandColor }}>{clinic.name}</p>
                <p className="text-sm text-gray-500 mt-4 max-w-[250px] mx-auto">You'll receive a WhatsApp confirmation shortly.</p>
              </div>
              <div className="pt-8">
                <a href="https://kinetimap.com" target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 tracking-wide uppercase">
                  Powered by KinetiMap
                </a>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
