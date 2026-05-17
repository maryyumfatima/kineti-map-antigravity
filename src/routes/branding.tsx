import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Copy, Upload, Check, Building2, Eye, EyeOff } from 'lucide-react'
import { PhoneInput } from '../components/PhoneInput'

export const Route = createFileRoute('/branding')({
  component: BrandingPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type ClinicForm = {
  name: string
  bio: string
  whatsapp_number: string
  logo_url: string
  brand_color: string
  secondary_color: string
  text_color: string
  appointment_price: string
  currency: string
  default_slot_duration: number
  booking_page_mode: 'open' | 'invite_only' | 'closed'
  slug: string
  // Contact details (Issue 2)
  contact_email: string
  contact_phone: string
  website_url: string
}

// Removed CURRENCIES array for UK-only launch

const DURATIONS = [30, 45, 60, 90]

const DEFAULT_FORM: ClinicForm = {
  name: '',
  bio: '',
  whatsapp_number: '',
  logo_url: '',
  brand_color: '#006D77',
  secondary_color: '#D9B29C',
  text_color: '#32323f',
  appointment_price: '',
  currency: 'GBP',
  default_slot_duration: 60,
  booking_page_mode: 'open',
  slug: '',
  contact_email: '',
  contact_phone: '',
  website_url: '',
}

// currencySymbol removed

// ─── Page ─────────────────────────────────────────────────────────────────────

function BrandingPage() {
    const [form, setForm] = useState<ClinicForm>(DEFAULT_FORM)
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchClinic() }, [])

  const fetchClinic = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('[Branding] No user found')
        return
      }

      const { data: cu, error: cuErr } = await supabase
        .from('clinic_users')
        .select('clinic_id')
        .eq('auth_user_id', user.id)
        .single()

      if (cuErr || !cu) {
        console.log('[Branding] clinic_users error:', cuErr)
        return
      }

      console.log('[Branding] clinic_id:', cu.clinic_id)
      setClinicId(cu.clinic_id)

      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', cu.clinic_id)
        .single()

      if (error) {
        console.log('[Branding] clinics fetch error:', error)
        throw error
      }

      console.log('[Branding] clinic data:', data)

      if (data) {
        setForm({
          name: data.name ?? '',
          bio: data.bio ?? '',
          whatsapp_number: data.whatsapp_number ?? '',
          logo_url: data.logo_url ?? '',
          brand_color: data.brand_color ?? '#006D77',
          secondary_color: data.secondary_color ?? '#D9B29C',
          text_color: data.text_color ?? '#32323f',
          appointment_price: data.appointment_price != null ? String(data.appointment_price) : '',
          currency: data.currency ?? 'GBP',
          default_slot_duration: data.default_slot_duration ?? 60,
          booking_page_mode: data.booking_page_mode ?? 'open',
          slug: data.slug ?? '',
          contact_email: data.contact_email ?? '',
          contact_phone: data.contact_phone ?? '',
          website_url: data.website_url ?? '',
        })
      }
    } catch (e) {
      console.error('[Branding] fetchClinic error:', e)
      toast.error('Failed to load clinic data')
    } finally {
      setLoading(false)
    }
  }

  const set = <K extends keyof ClinicForm>(key: K, value: ClinicForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      toast.error('No file selected')
      return
    }
    if (!clinicId) {
      toast.error('Clinic ID missing — refresh the page and try again')
      return
    }
    // Pre-flight checks
    if (file.size > 2 * 1024 * 1024) {
      toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 2MB allowed.`)
      return
    }
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error(`Invalid file type: ${file.type}. Use PNG, JPG, or WebP.`)
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `${clinicId}/logo-${Date.now()}.${ext}`
      console.log('[Branding] Uploading logo:', { path, size: file.size, type: file.type })

      const { error: upErr } = await supabase.storage
        .from('clinic-logos')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (upErr) {
        console.error('[Branding] Supabase upload error:', upErr)
        throw upErr
      }

      const { data: urlData } = supabase.storage
        .from('clinic-logos')
        .getPublicUrl(path)
      // Add cache-busting param so old cached version isn't shown
      const freshUrl = `${urlData.publicUrl}?t=${Date.now()}`
      set('logo_url', freshUrl)
      toast.success('Logo uploaded successfully')
    } catch (err: any) {
      console.error('[Branding] logo upload error:', err)
      const msg = err?.message || err?.error || 'Unknown error'
      toast.error(`Logo upload failed: ${msg}`)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!clinicId) {
      toast.error('Clinic ID not found — try refreshing the page')
      return
    }

    setSaving(true)

    // Core columns that must exist in the clinics table
    const corePayload = {
      name: form.name,
      bio: form.bio || null,
      whatsapp_number: form.whatsapp_number || null,
      logo_url: form.logo_url || null,
      brand_color: form.brand_color,
      secondary_color: form.secondary_color,
      text_color: form.text_color,
      appointment_price: form.appointment_price ? Number(form.appointment_price) : null,
      currency: form.currency,
      default_slot_duration: form.default_slot_duration,
    }

    // Extended columns added via SQL migration
    const extendedPayload = {
      ...corePayload,
      booking_page_mode: form.booking_page_mode,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      website_url: form.website_url || null,
    }

    console.log('[Branding] clinic_id:', clinicId)
    console.log('[Branding] Attempting full save with payload:', extendedPayload)

    try {
      // Try full payload first (works if SQL migration has been run)
      const { data, error } = await supabase
        .from('clinics')
        .update(extendedPayload)
        .eq('id', clinicId)
        .select()

      console.log('[Branding] Full update response — data:', data, 'error:', error)

      if (error) {
        // If columns don't exist yet, fall back to core payload
        const isColumnMissing =
          error.message?.includes('column') ||
          error.code === '42703' || // PostgreSQL: undefined column
          error.message?.includes('does not exist')

        if (isColumnMissing) {
          console.warn('[Branding] Extended columns not found, falling back to core payload')
          const { data: coreData, error: coreError } = await supabase
            .from('clinics')
            .update(corePayload)
            .eq('id', clinicId)
            .select()

          console.log('[Branding] Core update response — data:', coreData, 'error:', coreError)

          if (coreError) throw coreError

          toast.success('Core branding saved! Run the SQL migration to save contact details.')
        } else {
          throw error
        }
      } else {
        toast.success('Branding saved!')
      }
    } catch (e: any) {
      console.error('[Branding] save error:', e)
      toast.error(`Save failed: ${e?.message ?? 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  // Issue 3: Copy full URL and show toast
  const handleCopy = () => {
    const fullUrl = `https://kinetimap.app/book/${form.slug || 'your-clinic'}`
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true)
      toast.success('Booking link copied!')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm bg-white'
  const labelClass = 'block text-sm font-medium text-text mb-1'

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-sm text-text/50">Loading branding settings…</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-[28px] font-bold text-primary font-bricolage mb-8">Branding</h1>

        {/* Mobile-only floating Preview toggle (hidden when preview is open) */}
        {!showMobilePreview && (
          <button
            type="button"
            onClick={() => setShowMobilePreview(true)}
            className="lg:hidden fixed bottom-6 right-6 z-40 bg-primary text-white rounded-full shadow-lg px-5 py-3 flex items-center gap-2 text-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
            aria-label="Show preview"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
        )}

        <div className="flex flex-col lg:flex-row gap-8">

          {/* ══════════════ LEFT — Form ══════════════ */}
          <div className="flex-1 space-y-6">

            {/* Section 1: Clinic Identity */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold text-text font-bricolage mb-5">Clinic Identity</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Clinic name *</label>
                  <input
                    required type="text" value={form.name}
                    onChange={e => set('name', e.target.value)}
                    className={inputClass} placeholder="e.g. Central Physio Clinic"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Bio
                    <span className={`ml-auto float-right font-normal text-xs ${form.bio.length > 280 ? 'text-alert' : 'text-text/40'}`}>
                      {form.bio.length}/300
                    </span>
                  </label>
                  <textarea
                    value={form.bio}
                    onChange={e => e.target.value.length <= 300 && set('bio', e.target.value)}
                    rows={4} className={`${inputClass} resize-none`}
                    placeholder="A short description of your clinic and approach…"
                  />
                </div>
                <div>
                  <label className={labelClass}>WhatsApp number</label>
                  <PhoneInput
                    value={form.whatsapp_number}
                    onChange={v => set('whatsapp_number', v)}
                    placeholder="+447700900000"
                    defaultCountry="GB"
                    className="w-full px-3 py-1.5 rounded-lg border border-border focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary outline-none text-sm bg-white"
                  />
                  <p className="text-xs text-text/40 mt-1">E.164 format — include country code</p>
                </div>

                {/* ── Contact Details subsection (Issue 2) ── */}
                <div className="pt-2 border-t border-border">
                  <p className="text-sm font-semibold text-text mb-3">Contact Details</p>
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Email address</label>
                      <input
                        type="email" value={form.contact_email}
                        onChange={e => set('contact_email', e.target.value)}
                        className={inputClass} placeholder="hello@yourclinic.com"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Phone number</label>
                      <PhoneInput
                        value={form.contact_phone}
                        onChange={v => set('contact_phone', v)}
                        placeholder="+441234567890"
                        defaultCountry="GB"
                        className="w-full px-3 py-1.5 rounded-lg border border-border focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary outline-none text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Website URL</label>
                      <input
                        type="url" value={form.website_url}
                        onChange={e => set('website_url', e.target.value)}
                        className={inputClass} placeholder="https://yourclinic.com"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Visual Branding */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold text-text font-bricolage mb-5">Visual Branding</h2>
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Clinic logo</label>
                  <div className="flex items-center gap-4">
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="Logo" className="w-16 h-16 rounded-xl object-cover border border-border shadow-sm" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-background border border-border flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-text/20" />
                      </div>
                    )}
                    <div>
                      <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 border border-border text-text text-sm font-medium px-4 py-2 rounded-lg hover:bg-background transition-colors disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        {uploading ? 'Uploading…' : 'Upload Logo'}
                      </button>
                      <p className="text-xs text-text/40 mt-1">PNG, JPG up to 2MB</p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Brand color (primary)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color" value={form.brand_color}
                      onChange={e => set('brand_color', e.target.value)}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-white"
                    />
                    <input
                      type="text" value={form.brand_color}
                      onChange={e => set('brand_color', e.target.value)}
                      className={`${inputClass} w-36 font-mono uppercase`}
                      maxLength={7} placeholder="#006D77"
                    />
                    <div className="w-10 h-10 rounded-lg border border-border shadow-sm flex-shrink-0" style={{ backgroundColor: form.brand_color }} />
                  </div>
                  <p className="text-xs text-text/40 mt-1">Used for buttons, badges, and main accents</p>
                </div>
                <div>
                  <label className={labelClass}>Secondary color (accent)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color" value={form.secondary_color}
                      onChange={e => set('secondary_color', e.target.value)}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-white"
                    />
                    <input
                      type="text" value={form.secondary_color}
                      onChange={e => set('secondary_color', e.target.value)}
                      className={`${inputClass} w-36 font-mono uppercase`}
                      maxLength={7} placeholder="#D9B29C"
                    />
                    <div className="w-10 h-10 rounded-lg border border-border shadow-sm flex-shrink-0" style={{ backgroundColor: form.secondary_color }} />
                  </div>
                  <p className="text-xs text-text/40 mt-1">Used for highlights, soft backgrounds, and pain markers</p>
                </div>
                <div>
                  <label className={labelClass}>Text color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color" value={form.text_color}
                      onChange={e => set('text_color', e.target.value)}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-white"
                    />
                    <input
                      type="text" value={form.text_color}
                      onChange={e => set('text_color', e.target.value)}
                      className={`${inputClass} w-36 font-mono uppercase`}
                      maxLength={7} placeholder="#32323f"
                    />
                    <div className="w-10 h-10 rounded-lg border border-border shadow-sm flex-shrink-0" style={{ backgroundColor: form.text_color }} />
                  </div>
                  <p className="text-xs text-text/40 mt-1">Used for headings and body text on your booking page</p>
                </div>
              </div>
            </div>

            {/* Section 3: Appointment Settings */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold text-text font-bricolage mb-5">Appointment Settings</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Appointment price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text/50">
                        £
                      </span>
                      <input
                        type="number" min="0" step="0.01" value={form.appointment_price}
                        onChange={e => set('appointment_price', e.target.value)}
                        className={`${inputClass} pl-7`} placeholder="60.00"
                      />
                    </div>
                  </div>
                  {/* Currency selector removed for UK-only launch */}
                </div>
                <div>
                  <label className={labelClass}>Default slot duration</label>
                  <div className="flex gap-2 flex-wrap">
                    {DURATIONS.map(d => (
                      <button key={d} type="button" onClick={() => set('default_slot_duration', d)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${form.default_slot_duration === d
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-text border-border hover:border-primary/40'
                          }`}
                      >
                        {d} min
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Booking Page Control */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold text-text font-bricolage mb-5">Booking Page Control</h2>
              <div className="space-y-3 mb-5">
                {([
                  { value: 'open', label: 'Open', desc: 'Anyone with the link can book' },
                  { value: 'invite_only', label: 'Invite Only', desc: 'Physio sends a private link' },
                  { value: 'closed', label: 'Closed', desc: 'Shows a contact message only' },
                ] as const).map(opt => (
                  <label key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.booking_page_mode === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                      }`}
                  >
                    <input
                      type="radio" name="booking_page_mode" value={opt.value}
                      checked={form.booking_page_mode === opt.value}
                      onChange={() => set('booking_page_mode', opt.value)}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <p className="text-sm font-semibold text-text">{opt.label}</p>
                      <p className="text-xs text-text/50">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Issue 3 — Booking link from actual slug */}
              <div>
                <label className={labelClass}>Your booking link</label>
                {form.slug ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm text-text/70 font-mono truncate">
                      kinetimap.app/book/<span className="text-primary font-semibold">{form.slug}</span>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 border border-border text-text text-sm font-medium px-3 py-2 rounded-lg hover:bg-background transition-colors whitespace-nowrap"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-text/40 italic px-3 py-2 bg-background border border-border rounded-lg">
                    No slug set — contact support to configure your booking URL.
                  </p>
                )}
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving || !form.name}
              className="w-full bg-primary hover:opacity-90 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm"
            >
              {saving ? 'Saving…' : 'Save Branding'}
            </button>
          </div>

          {/* ══════════════ RIGHT — Live Preview ══════════════ */}
          <div className={`lg:w-80 xl:w-96 shrink-0 ${showMobilePreview ? 'block' : 'hidden lg:block'}`}>
            <div className="lg:sticky lg:top-8">
              <div className="flex items-center justify-between mb-3 lg:justify-center">
                <p className="text-xs font-semibold text-text/50 uppercase tracking-widest text-center">
                  How your booking page looks to patients
                </p>
                <button
                  type="button"
                  onClick={() => setShowMobilePreview(false)}
                  className="lg:hidden text-text/50 hover:text-text p-1"
                  aria-label="Hide preview"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-white border-[3px] border-gray-800 rounded-[36px] shadow-2xl overflow-hidden mx-auto max-w-xs">
                <div className="h-7 bg-gray-800 flex items-center justify-center">
                  <div className="w-20 h-1.5 bg-gray-600 rounded-full" />
                </div>
                <div className="bg-background min-h-[520px] flex flex-col">
                  <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center" style={{ backgroundColor: form.secondary_color + '33' }}>
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="Logo" className="w-16 h-16 rounded-2xl object-cover shadow-md mb-3 border-2 border-white" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl shadow-md mb-3 flex items-center justify-center text-white font-bold text-2xl font-bricolage"
                        style={{ backgroundColor: form.brand_color }}>
                        {form.name ? form.name[0].toUpperCase() : '?'}
                      </div>
                    )}
                    <h3 className="text-base font-bold font-bricolage leading-tight" style={{ color: form.text_color }}>
                      {form.name || 'Your Clinic Name'}
                    </h3>
                  </div>
                  <div className="px-5 py-4 flex-1 flex flex-col gap-4">
                    {form.bio && (
                      <p className="text-xs leading-relaxed text-center" style={{ color: form.text_color, opacity: 0.7 }}>{form.bio}</p>
                    )}
                    {form.appointment_price && (
                      <div className="flex justify-center">
                        <span className="text-xs font-semibold px-3 py-1 rounded-full text-white" style={{ backgroundColor: form.brand_color }}>
                          {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(form.appointment_price))} · {form.default_slot_duration} min
                        </span>
                      </div>
                    )}
                    <button className="mt-auto w-full py-3 rounded-xl text-white text-sm font-bold shadow-md" style={{ backgroundColor: form.brand_color }}>
                      Book an Appointment
                    </button>
                    {form.booking_page_mode === 'invite_only' && (
                      <p className="text-xs text-text/40 text-center italic">Invite only — private link required</p>
                    )}
                    {form.booking_page_mode === 'closed' && (
                      <p className="text-xs text-text/40 text-center italic">Bookings closed — contact us to enquire</p>
                    )}
                    <p className="text-[10px] text-text/25 text-center mt-2">Powered by KinetiMap</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}