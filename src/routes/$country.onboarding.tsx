import { createFileRoute, useNavigate, Link, useParams } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Check, Upload, Copy, Share, Users, LayoutDashboard, Building2 } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/$country/onboarding')({
  component: OnboardingPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type DaySchedule = {
  enabled: boolean
  start: string
  end: string
}

type WeeklySchedule = Record<string, DaySchedule>

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const DEFAULT_SCHEDULE: WeeklySchedule = Object.fromEntries(
  DAYS.map((d) => [d, { enabled: !['Saturday', 'Sunday'].includes(d), start: '09:00', end: '17:00' }])
)

// ─── Components ───────────────────────────────────────────────────────────────

function LeftPanel({ step }: { step: number }) {
  return (
    <div className="hidden-mobile" style={{
      width: '40%', minHeight: '100vh', background: '#006D77',
      padding: '48px 40px', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', flexShrink: 0,
    }}>
      <div>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '28px', fontWeight: 700, color: '#fff', margin: 0 }}>KinetiMap</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '16px', marginTop: '8px', marginBottom: 0 }}>
          Let's get your clinic set up.
        </p>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '32px 0' }} />

        {/* Progress Tracker */}
        <div className="flex flex-col gap-8">
          {[
            { num: 1, title: 'Clinic Profile', desc: 'Logo, brand color, bio' },
            { num: 2, title: 'Availability', desc: 'When patients can book' },
            { num: 3, title: "You're ready!", desc: 'Get your booking link' },
          ].map((item) => {
            const isActive = step === item.num
            const isCompleted = step > item.num
            return (
              <div key={item.num} className="flex items-start gap-4 transition-opacity" style={{ opacity: isActive || isCompleted ? 1 : 0.5 }}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${isActive ? 'bg-white text-primary ring-4 ring-white/20' :
                    isCompleted ? 'bg-[#D9B29C] text-white' :
                      'bg-white/20 text-white'
                  }`}>
                  {isCompleted ? <Check size={16} strokeWidth={3} /> : item.num}
                </div>
                <div>
                  <p className="text-white font-semibold text-base mb-0.5">{item.title}</p>
                  <p className="text-white/70 text-sm">{item.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const { country } = useParams({ strict: false }) as { country: string }

  // Step 1 Data
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [brandColor, setBrandColor] = useState('#006D77')
  const [logoUrl, setLogoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)

  // Step 2 Data
  const [schedule, setSchedule] = useState<WeeklySchedule>(DEFAULT_SCHEDULE)

  // Step 3 Data
  const [slug, setSlug] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate({ to: '/$country/login', params: { country } as any }); return }

      const { data: cu, error: cuErr } = await supabase
        .from('clinic_users')
        .select('clinic_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (cuErr) {
        console.error('[Onboarding] clinic_users fetch error:', cuErr)
      }

      // If no clinic exists, the auto-create trigger may have failed.
      // Fall back to creating one client-side so the user isn't stuck.
      if (!cu) {
        console.warn('[Onboarding] No clinic found for user, creating fallback...')
        const meta = (user.user_metadata as any) || {}
        const fallbackName = meta.clinic_name || 'My Clinic'
        const baseSlug = (fallbackName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'clinic')
        // Try a few slug variations to avoid collisions
        let workingSlug = baseSlug
        for (let i = 1; i < 50; i++) {
          const { data: existing } = await supabase.from('clinics').select('id').eq('slug', workingSlug).maybeSingle()
          if (!existing) break
          workingSlug = `${baseSlug}-${i}`
        }
        const { data: newClinic, error: createErr } = await supabase.from('clinics').insert({
          name: fallbackName,
          slug: workingSlug,
          whatsapp_number: meta.whatsapp_number || null,
          brand_color: '#006D77',
          secondary_color: '#D9B29C',
          text_color: '#2C1A12',
          appointment_price: 50,
          currency: 'GBP',
          default_slot_duration: 60,
          booking_page_mode: 'open',
          onboarding_completed: false,
        }).select('id').single()
        if (createErr || !newClinic) {
          toast.error('Could not set up your clinic. Please contact support.')
          return
        }
        await supabase.from('clinic_users').insert({
          clinic_id: newClinic.id,
          auth_user_id: user.id,
          role: 'owner',
        })
        // Set sensible default availability (Mon–Fri 9am–7pm)
        await supabase.from('availability_slots').insert([
          { clinic_id: newClinic.id, day_of_week: 1, start_time: '09:00:00', end_time: '19:00:00', slot_duration_minutes: 60, is_active: true },
          { clinic_id: newClinic.id, day_of_week: 2, start_time: '09:00:00', end_time: '19:00:00', slot_duration_minutes: 60, is_active: true },
          { clinic_id: newClinic.id, day_of_week: 3, start_time: '09:00:00', end_time: '19:00:00', slot_duration_minutes: 60, is_active: true },
          { clinic_id: newClinic.id, day_of_week: 4, start_time: '09:00:00', end_time: '19:00:00', slot_duration_minutes: 60, is_active: true },
          { clinic_id: newClinic.id, day_of_week: 5, start_time: '09:00:00', end_time: '19:00:00', slot_duration_minutes: 60, is_active: true },
        ])
        setClinicId(newClinic.id)
        setName(fallbackName)
        setSlug(workingSlug)
        return
      }

      setClinicId(cu.clinic_id)

      const { data: clinic } = await supabase.from('clinics').select('*').eq('id', cu.clinic_id).single()
      if (clinic) {
        if (clinic.onboarding_completed) {
          navigate({ to: '/$country/dashboard', params: { country } as any })
          return
        }
        setName(clinic.name || '')
        setBio(clinic.bio || '')
        if (clinic.brand_color) setBrandColor(clinic.brand_color)
        setLogoUrl(clinic.logo_url || '')
        if (clinic.weekly_schedule) setSchedule(clinic.weekly_schedule)
        setSlug(clinic.slug || '')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !clinicId) return
    if (file.size > 2 * 1024 * 1024) { toast.error('File must be less than 2MB'); return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${clinicId}/logo.${ext}`
      const { error } = await supabase.storage.from('clinic-logos').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('clinic-logos').getPublicUrl(path)
      setLogoUrl(data.publicUrl)
      toast.success('Logo uploaded')
    } catch (e) {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const saveStep1 = async () => {
    if (!clinicId) return
    setSaving(true)
    try {
      const { error } = await supabase.from('clinics').update({
        name, bio, brand_color: brandColor, logo_url: logoUrl
      }).eq('id', clinicId)
      if (error) throw error
      setStep(2)
    } catch (e) {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
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
      setCsvFile(file)

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
      setCsvFile(null)
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

  const toggleDay = (day: string) => setSchedule(prev => ({ ...prev, [day]: { ...prev[day], enabled: !prev[day].enabled } }))
  const updateDay = (day: string, field: 'start' | 'end', value: string) => setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))

  const saveStep2 = async () => {
    if (!clinicId) return
    setSaving(true)
    try {
      const map: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 }

      const slots = Object.entries(schedule).map(([day, data]) => ({
        clinic_id: clinicId,
        day_of_week: map[day],
        start_time: data.start,
        end_time: data.end,
        slot_duration_minutes: 60,
        is_active: data.enabled
      }))

      // Clear any existing slots just in case
      await supabase.from('availability_slots').delete().eq('clinic_id', clinicId)

      // Insert new slots
      const { error } = await supabase.from('availability_slots').insert(slots)

      if (error) throw error
      setStep(3)
    } catch (e) {
      console.error(e)
      toast.error('Failed to save availability')
    } finally {
      setSaving(false)
    }
  }

  const completeOnboarding = async () => {
    if (!clinicId) return
    setSaving(true)
    try {
      await supabase.from('clinics').update({ onboarding_completed: true }).eq('id', clinicId)
      navigate({ to: '/$country/dashboard', params: { country } as any })
    } catch (e) {
      toast.error('Failed to complete onboarding')
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = () => {
    const fullUrl = `https://kinetimap.app/book/${slug || clinicId}`
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true)
      toast.success('Link copied!')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-text/50">Loading…</div>
  }

  const inputClass = "w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm bg-background transition-colors"
  const labelClass = "block text-sm font-semibold text-text mb-1.5"

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fff' }}>
      <LeftPanel step={step} />

      <div style={{
        flex: 1, background: '#fff', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '48px 40px',
        overflowY: 'auto',
      }}>
        <div className="w-full max-w-md auth-card-in">

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-bricolage text-[26px] font-bold text-text mb-1">Set up your clinic profile</h2>
                <p className="text-text/60 text-sm">This is what patients will see on your booking page.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Clinic name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="Central Physio" />
                </div>
                <div>
                  <label className={labelClass}>
                    Bio
                    <span className={`float-right font-normal text-xs ${bio.length > 300 ? 'text-alert' : 'text-text/40'}`}>
                      {bio.length}/300
                    </span>
                  </label>
                  <textarea value={bio} onChange={e => e.target.value.length <= 300 && setBio(e.target.value)} rows={3} className={`${inputClass} resize-none`} placeholder="Tell patients about your clinic…" />
                </div>

                <div>
                  <label className={labelClass}>Clinic logo (optional)</label>
                  <div className="flex items-center gap-4 mt-2">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-xl object-cover border border-border shadow-sm" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-background border border-border flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-text/20" />
                      </div>
                    )}
                    <div>
                      <input ref={fileRef} type="file" accept="image/png, image/jpeg" onChange={handleLogoUpload} className="hidden" />
                      <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2 border border-border text-text text-sm font-medium px-4 py-2 rounded-lg hover:bg-background transition-colors disabled:opacity-50">
                        <Upload className="w-4 h-4" />
                        {uploading ? 'Uploading…' : 'Upload Logo'}
                      </button>
                      <p className="text-xs text-text/40 mt-1.5">PNG, JPG up to 2MB</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Brand color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="w-12 h-12 rounded-xl border border-border cursor-pointer p-0.5 bg-white" />
                    <input type="text" value={brandColor} onChange={e => setBrandColor(e.target.value)} className={`${inputClass} w-36 font-mono uppercase uppercase`} maxLength={7} />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <button onClick={saveStep1} disabled={saving || !name} className="w-full bg-primary hover:bg-[#005560] text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-60 text-[15px]">
                  {saving ? 'Saving…' : 'Continue →'}
                </button>
                <button onClick={() => setStep(2)} className="text-text/50 text-sm font-medium hover:text-text transition-colors mx-auto px-4 py-2">
                  Skip for now
                </button>
              </div>

              {/* IMPORT SECTION */}
              <div className="mt-12 pt-8 border-t border-border">
                <div className="mb-4">
                  <h3 className="font-bricolage text-[20px] font-bold text-text mb-1">Import existing patients</h3>
                  <p className="text-text/60 text-sm">Already have patient data? Import it now — takes 2 minutes</p>
                </div>

                {!csvFile ? (
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-gray-50/50">
                    <Upload className="w-8 h-8 text-primary/40 mx-auto mb-3" />
                    <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" id="csv-upload" />
                    <label htmlFor="csv-upload" className="cursor-pointer bg-white border border-border px-4 py-2 rounded-lg text-sm font-semibold text-text hover:bg-gray-50 transition-colors">
                      Upload CSV
                    </label>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="bg-white border border-border rounded-xl overflow-hidden">
                      <div className="p-4 border-b border-border bg-gray-50 flex justify-between items-center">
                        <h4 className="font-semibold text-sm">Map Columns</h4>
                        <button onClick={() => setCsvFile(null)} className="text-xs text-text/50 hover:text-text">Cancel</button>
                      </div>
                      <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                        {csvHeaders.map((h) => (
                          <div key={h} className="p-3 flex items-center justify-between gap-4">
                            <span className="text-sm font-medium text-text truncate flex-1" title={h}>{h}</span>
                            <select
                              value={csvMapping[h] || 'skip'}
                              onChange={(e) => setCsvMapping({ ...csvMapping, [h]: e.target.value })}
                              className="w-[180px] text-sm border border-border rounded-md px-2 py-1.5 outline-none focus:border-primary"
                            >
                              {KINETIMAP_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    {importing && (
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden">
                        <div className="bg-primary h-2 rounded-full animate-pulse w-full"></div>
                      </div>
                    )}

                    <button
                      onClick={handleImportCsv}
                      disabled={importing}
                      className="w-full bg-primary hover:bg-[#005560] text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-60"
                    >
                      {importing ? 'Importing...' : `Import ${csvRows.length} patients`}
                    </button>

                    <div className="text-center">
                      <button onClick={() => setCsvFile(null)} className="text-sm text-text/50 hover:text-text">Skip import</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-bricolage text-[26px] font-bold text-text mb-1">When are you available?</h2>
                <p className="text-text/60 text-sm">Patients will only see these slots when booking.</p>
              </div>

              <div className="bg-white border border-border rounded-2xl shadow-sm divide-y divide-border">
                {DAYS.map((day) => {
                  const dayData = schedule[day]
                  return (
                    <div key={day} className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${!dayData.enabled ? 'bg-background/30' : ''}`}>
                      <button onClick={() => toggleDay(day)} className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${dayData.enabled ? 'bg-primary' : 'bg-gray-300'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${dayData.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                      <span className={`w-24 text-sm font-medium ${dayData.enabled ? 'text-text' : 'text-text/40'}`}>{day.substring(0, 3)}</span>
                      {dayData.enabled ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input type="time" value={dayData.start} onChange={e => updateDay(day, 'start', e.target.value)} className="border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary flex-1 bg-white" />
                          <span className="text-text/40 text-xs">-</span>
                          <input type="time" value={dayData.end} onChange={e => updateDay(day, 'end', e.target.value)} className="border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary flex-1 bg-white" />
                        </div>
                      ) : (
                        <span className="text-sm text-text/30 italic flex-1">Off</span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <button onClick={saveStep2} disabled={saving} className="w-full bg-primary hover:bg-[#005560] text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-60 text-[15px]">
                  {saving ? 'Saving…' : 'Continue →'}
                </button>
                <button onClick={() => setStep(3)} className="text-text/50 text-sm font-medium hover:text-text transition-colors mx-auto px-4 py-2">
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[#E1F5EE] text-[#0F6E56] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={32} strokeWidth={3} />
                </div>
                <h2 className="font-bricolage text-[26px] font-bold text-text mb-2">Your KinetiMap is ready 🎉</h2>
                <p className="text-text/60 text-sm">Share your booking link with patients to get started.</p>
              </div>

              <div className="bg-background border border-border p-5 rounded-2xl">
                <p className="text-xs font-semibold text-text/50 uppercase tracking-widest mb-2">Your Booking Link</p>
                <div className="flex items-center gap-2 bg-white border border-border rounded-xl p-1 shadow-sm">
                  <div className="flex-1 px-3 py-2 text-sm text-text/80 font-mono truncate">
                    kinetimap.app/book/<span className="text-primary font-semibold">{slug || clinicId}</span>
                  </div>
                  <button onClick={handleCopy} className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#005560] transition-colors shrink-0">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 pt-2">
                <div className="border border-border rounded-xl p-4 flex items-center gap-4 bg-white shadow-sm hover:border-primary/30 transition-colors cursor-pointer" onClick={handleCopy}>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Share className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-text">Share your booking link</p>
                    <p className="text-xs text-text/60 mt-0.5">Send this to your patients via WhatsApp or Instagram.</p>
                  </div>
                </div>

                <Link to="/$country/patients" params={{ country } as any} className="border border-border rounded-xl p-4 flex items-center gap-4 bg-white shadow-sm hover:border-primary/30 transition-colors" onClick={() => supabase.from('clinics').update({ onboarding_completed: true }).eq('id', clinicId!)}>
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-[#C4957D]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-text">Add your first patient</p>
                    <p className="text-xs text-text/60 mt-0.5">Or let patients book themselves.</p>
                  </div>
                </Link>

                <button onClick={completeOnboarding} className="border border-border rounded-xl p-4 flex items-center gap-4 bg-white shadow-sm hover:border-primary/30 transition-colors text-left w-full">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <LayoutDashboard className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-text">View your dashboard</p>
                    <p className="text-xs text-text/60 mt-0.5">Go to your KinetiMap dashboard.</p>
                  </div>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}