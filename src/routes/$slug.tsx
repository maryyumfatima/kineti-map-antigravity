import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Check, AlertCircle } from 'lucide-react'
import { BodyMap } from '../components/BodyMap'

export const Route = createFileRoute('/$slug')({
  component: BookingPage,
})

// ─── Shared Helpers ───────────────────────────────────────────────────────────

function calculateAge(dob: string) {
  if (!dob) return 999
  const birth = new Date(dob)
  const diff = Date.now() - birth.getTime()
  return new Date(diff).getUTCFullYear() - 1970
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

// ─── Main Page ────────────────────────────────────────────────────────────────

function BookingPage() {
  const { slug } = Route.useParams()
  const [loading, setLoading] = useState(true)
  const [clinic, setClinic] = useState<any>(null)

  const isDemo = slug === 'demo'
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

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [allSlots, setAllSlots] = useState<any[]>([])

  // Step 3: Where does it hurt?
  const [painData, setPainData] = useState<Record<string, number>>({})

  // Step 4: Medical background
  const [surgeries, setSurgeries] = useState('')
  const [conditions, setConditions] = useState('')
  const [medications, setMedications] = useState('')
  const [allergies, setAllergies] = useState('')
  const [occupation, setOccupation] = useState('')

  // Step 5: Safety questions
  const [q1, setQ1] = useState<string | null>(null)
  const [q2, setQ2] = useState<string | null>(null)
  const [q3, setQ3] = useState<string | null>(null)
  const [q4, setQ4] = useState<string | null>(null)

  // Step 6: Consent
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
    try {
      const { data: clinicData } = await supabase
        .from('clinics')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

      if (clinicData) {
        setClinic(clinicData)

        // Fetch Availability & Bookings
        const [availRes, bookingsRes] = await Promise.all([
          supabase.from('availability_slots').select('*').eq('clinic_id', clinicData.id).eq('is_active', true),
          supabase.from('bookings').select('appointment_time').eq('clinic_id', clinicData.id).neq('status', 'cancelled').gte('appointment_time', new Date().toISOString())
        ])

        if (availRes.data) {
          generateAllSlots(availRes.data, bookingsRes.data || [])
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const generateAllSlots = (avail: any[], currentBookings: any[]) => {
    const slots: any[] = []
    const bookedTimes = new Set(currentBookings.map(b => b.appointment_time))

    // Generate for next 14 days
    for (let i = 0; i < 14; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i)
      const dayOfWeek = date.getDay()

      const dayConfig = avail.find(a => a.day_of_week === dayOfWeek)
      if (dayConfig) {
        const [startH, startM] = dayConfig.start_time.split(':').map(Number)
        const [endH, endM] = dayConfig.end_time.split(':').map(Number)
        const duration = dayConfig.slot_duration_minutes || 60

        let current = new Date(date)
        current.setHours(startH, startM, 0, 0)

        const end = new Date(date)
        end.setHours(endH, endM, 0, 0)

        while (current < end) {
          const iso = current.toISOString()
          // Only show future slots
          if (current > new Date()) {
            slots.push({
              iso,
              time: current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              date: current.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }),
              dateKey: current.toISOString().split('T')[0],
              isBooked: bookedTimes.has(iso)
            })
          }
          current = new Date(current.getTime() + duration * 60000)
        }
      }
    }
    setAllSlots(slots)

    // Auto-select first available date
    const firstDate = slots[0]?.dateKey
    if (firstDate) setSelectedDate(firstDate)
  }



  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault()

    console.log("Confirm booking clicked")
    console.log("form data:", { fullName, whatsapp, dob, clinicId: clinic?.id, consent1, honeypot })

    if (honeypot) {
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
        setStep(8)
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
      const painDataJson = painData
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
        appointment_time: selectedSlot,
        appointment_price: clinic.appointment_price ? parseInt(clinic.appointment_price) : null,
        pain_data: painDataJson,
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

      setStep(7)
    } catch (err: any) {
      console.error("Booking Error:", err)
      toast.error(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const verifyOtp = async () => {
    if (otpCode === generatedOtp) {
      setStep(8)
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
  const secondaryColor = clinic.secondary_color || '#D9B29C'
  const textColor = clinic.text_color || '#2C1A12'
  const isMinor = calculateAge(dob) < 16

  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 outline-none text-sm bg-gray-50 transition-colors"
  const labelClass = "block text-sm font-semibold text-gray-800 mb-1.5"

  return (
    <div className="min-h-screen bg-[#EDF6F9] py-12 px-4 sm:px-6 font-sans">

      {isDemo && (
        <div className="max-w-[560px] mx-auto mb-4 flex justify-center">
          <span className="inline-flex items-center gap-1.5 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-600 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Demo mode — try the full booking flow
          </span>
        </div>
      )}

      <div className="max-w-[560px] mx-auto">

        {/* HEADER */}
        {step < 6 && (
          <div className="text-center mb-8">
            {clinic.logo_url && (
              <img src={clinic.logo_url} alt={clinic.name} className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4 shadow-sm border border-gray-100" />
            )}
            <h1 className="text-2xl font-bold mb-2" style={{ color: textColor }}>{clinic.name}</h1>
            {clinic.bio && <p className="text-sm max-w-sm mx-auto mb-4 leading-relaxed" style={{ color: textColor, opacity: 0.65 }}>{clinic.bio}</p>}

            <div className="flex items-center justify-center gap-4 mt-6 mb-2">
              <div className="h-2 flex-1 rounded-full overflow-hidden" style={{ backgroundColor: secondaryColor + '40' }}>
                <div className="h-full transition-all duration-500 ease-out" style={{ width: `${(step / 6) * 100}%`, backgroundColor: brandColor }} />
              </div>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Step {step} of 6</p>
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
              <h2 className="text-xl font-bold text-gray-900 mb-2">Pick a time</h2>
              <p className="text-sm text-gray-500 mb-6">Choose an appointment slot that works for you.</p>

              {allSlots.length === 0 ? (
                <div className="py-8 px-4 bg-orange-50 border border-orange-100 rounded-xl text-center">
                  <p className="text-sm font-medium text-orange-800 mb-4">
                    This clinic has not set their availability yet. Please contact them directly.
                  </p>
                  {clinic.whatsapp_number && (
                    <a
                      href={`https://wa.me/${clinic.whatsapp_number?.replace(/\D/g, '') ?? ''}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-green-700 transition-colors"
                    >
                      WhatsApp {clinic.whatsapp_number}
                    </a>
                  )}
                </div>
              ) : (
                <>
                  {/* Date Selector */}
                  <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                    {Array.from(new Set(allSlots.map(s => s.dateKey))).map(dateKey => {
                      const slot = allSlots.find(s => s.dateKey === dateKey)
                      const isActive = selectedDate === dateKey
                      return (
                        <button
                          key={dateKey}
                          onClick={() => setSelectedDate(dateKey)}
                          className={`shrink-0 px-4 py-3 rounded-xl border-2 transition-all text-center min-w-[100px] ${isActive ? 'border-transparent shadow-md text-white' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'
                            }`}
                          style={{ backgroundColor: isActive ? brandColor : undefined }}
                        >
                          <div className={`text-[10px] uppercase font-bold tracking-wider ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                            {slot.date.split(' ')[0]}
                          </div>
                          <div className="text-sm font-bold">{slot.date.split(' ').slice(1).join(' ')}</div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Time Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {allSlots.filter(s => s.dateKey === selectedDate).map(slot => {
                      const isActive = selectedSlot === slot.iso
                      return (
                        <button
                          key={slot.iso}
                          disabled={slot.isBooked}
                          onClick={() => setSelectedSlot(slot.iso)}
                          className={`py-3 rounded-xl border-2 text-sm font-bold transition-all ${slot.isBooked ? 'bg-gray-100 border-transparent text-gray-300 cursor-not-allowed line-through' :
                            isActive ? 'border-transparent shadow-md text-white' : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200'
                            }`}
                          style={{ backgroundColor: isActive ? brandColor : undefined }}
                        >
                          {slot.time}
                        </button>
                      )
                    })}
                  </div>

                  {clinic.appointment_price && (
                    <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                      <span className="text-sm text-gray-500 font-medium">Appointment Price</span>
                      <span className="text-base font-bold text-gray-900">
                        {clinic.currency || '£'}{clinic.appointment_price}
                      </span>
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      disabled={!selectedSlot}
                      onClick={() => setStep(3)}
                      className="w-full text-white font-bold py-3.5 rounded-xl transition-transform active:scale-95 disabled:opacity-50"
                      style={{ backgroundColor: brandColor }}
                    >
                      Confirm Time & Continue →
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Where does it hurt?</h2>
              <p className="text-sm text-gray-500 italic text-center mb-6">Tap where it hurts.<br />Rate the pain 1–10.</p>

              <BodyMap
                mode="interactive"
                initialData={painData}
                onChange={(data) => setPainData(data)}
              />

              <div className="pt-4 flex flex-col gap-3">
                <button onClick={() => setStep(4)} className="w-full text-white font-bold py-3.5 rounded-xl transition-transform active:scale-95" style={{ backgroundColor: brandColor }}>
                  Next →
                </button>
                <button onClick={() => setStep(4)} className="text-gray-400 text-sm font-medium hover:text-gray-600">Skip this step</button>
              </div>
            </div>
          )}

          {step === 4 && (
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
                <button onClick={() => setStep(5)} className="w-full text-white font-bold py-3.5 rounded-xl transition-transform active:scale-95 mt-4" style={{ backgroundColor: brandColor }}>
                  Next →
                </button>
                <button onClick={() => setStep(5)} className="text-gray-400 text-sm font-medium hover:text-gray-600">Skip this step</button>
              </div>
            </div>
          )}

          {step === 5 && (
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
                      <button key={opt} onClick={() => q.set(opt)} className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${q.val === opt ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
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

              <button onClick={() => setStep(6)} className="w-full text-white font-bold py-3.5 rounded-xl transition-transform active:scale-95 mt-4" style={{ backgroundColor: brandColor }}>
                Next →
              </button>
            </div>
          )}

          {step === 6 && (
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

          {step === 7 && (
            <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-300 py-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify your number</h2>
              <p className="text-sm text-gray-500 mb-6 max-w-[280px] mx-auto">We sent a 6-digit code to <strong className="text-gray-800">{whatsapp}</strong>. Enter it below to confirm your booking.</p>

              <input type="text" maxLength={6} value={otpCode} onChange={e => setOtpCode(e.target.value?.replace(/\D/g, '') ?? '')} placeholder="000000" className="w-48 text-center text-3xl tracking-[0.25em] font-bold py-4 rounded-xl border-2 border-gray-200 focus:border-primary outline-none bg-gray-50 mx-auto block" style={{ outlineColor: brandColor }} />

              <button onClick={verifyOtp} disabled={otpCode.length !== 6} className="w-full text-white font-bold py-3.5 rounded-xl transition-transform active:scale-95 mt-6 disabled:opacity-50" style={{ backgroundColor: brandColor }}>
                Verify
              </button>

              <p className="text-sm text-gray-400 mt-4 cursor-pointer hover:text-gray-600">Resend code</p>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-500 py-8">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto bg-green-50">
                <Check className="w-10 h-10 text-green-500" strokeWidth={3} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
                <p className="font-semibold" style={{ color: brandColor }}>{clinic.name}</p>
                {selectedSlot && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 inline-block">
                    <p className="text-sm font-bold text-gray-900">
                      {new Date(selectedSlot).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    <p className="text-lg font-bold" style={{ color: brandColor }}>
                      {new Date(selectedSlot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-4 max-w-[250px] mx-auto">You'll receive a WhatsApp confirmation shortly.</p>
              </div>

              {isDemo && (
                <div className="mt-8 text-left bg-gray-50 p-6 rounded-xl border border-gray-200 animate-in fade-in zoom-in-95">
                  <h3 className="font-bold text-lg mb-4 text-gray-800">Demo Patient Summary</h3>
                  <div className="space-y-4 text-sm text-gray-600">
                    <p><strong>Name:</strong> {fullName}</p>
                    <p><strong>Status:</strong> All 6 steps completed</p>
                    <div>
                      <strong>Pain areas:</strong>
                      <div className="mt-4">
                        <BodyMap mode="readonly" initialData={painData} />
                      </div>
                    </div>
                  </div>
                  <button onClick={() => {
                    setFullName(''); setWhatsapp(''); setDob(''); setPainData({}); setStep(1);
                  }} className="w-full mt-6 bg-white border-2 border-[#006D77] text-[#006D77] font-bold py-3 rounded-xl hover:bg-gray-50 transition-colors">
                    Start fresh booking
                  </button>
                </div>
              )}

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