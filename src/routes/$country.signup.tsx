import { createFileRoute, useNavigate, Link, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Lock, User, Building2, Eye, EyeOff, Check } from 'lucide-react'
import { toast } from 'sonner'
import { PhoneInput } from '../components/PhoneInput'

export const Route = createFileRoute('/$country/signup')({
  component: Signup,
})

// ─── Shared components ────────────────────────────────────────────────────────

function AuthInput({
  icon: Icon, type = 'text', placeholder, value, onChange, inputRef,
}: {
  icon: React.ElementType; type?: string; placeholder: string
  value: string; onChange: (v: string) => void; inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <Icon size={15} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#006D77', pointerEvents: 'none' }} />
      <input
        ref={inputRef}
        type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          background: focused ? '#EDF6F9' : '#F7F9FA', border: 'none', borderRadius: '10px',
          padding: '12px 14px 12px 40px', fontSize: '14px', color: '#2C1A12',
          width: '100%', outline: 'none', transition: 'background 0.2s ease', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// Removed CustomPhoneInput in favor of shared component

function PasswordInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(false)
  const [eyeHover, setEyeHover] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <Lock size={15} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#006D77', pointerEvents: 'none' }} />
      <input
        type={visible ? 'text' : 'password'} placeholder="Password" value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          background: focused ? '#EDF6F9' : '#F7F9FA', border: 'none', borderRadius: '10px',
          padding: '12px 40px 12px 40px', fontSize: '14px', color: '#2C1A12',
          width: '100%', outline: 'none', transition: 'background 0.2s ease', boxSizing: 'border-box',
        }}
      />
      <button type="button" onClick={() => setVisible(v => !v)}
        onMouseEnter={() => setEyeHover(true)} onMouseLeave={() => setEyeHover(false)}
        tabIndex={-1}
        style={{
          position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
          color: eyeHover ? '#006D77' : '#aaa', transition: 'color 0.2s ease',
          display: 'flex', alignItems: 'center',
        }}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)
  return (
    <button type="submit" disabled={loading}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
      style={{
        background: hovered ? '#005560' : '#006D77', color: '#fff', fontSize: '14px',
        fontWeight: 600, borderRadius: '10px', padding: '13px', width: '100%', border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        transform: pressed ? 'scale(0.97)' : hovered ? 'scale(1.01)' : 'scale(1)',
        transition: 'background 0.2s ease, transform 0.15s ease',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? 'Creating account…' : label}
    </button>
  )
}

// ─── Left panel (shared) ──────────────────────────────────────────────────────

function LeftPanel() {
  const benefits = [
    'WhatsApp automation from day one',
    'Booking page ready in minutes',
    '14-day free trial, no card needed',
  ]
  return (
    <div style={{
      width: '40%', minHeight: '100vh', background: '#006D77',
      padding: '48px 40px', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', flexShrink: 0,
    }}
      className="hidden-mobile"
    >
      <div>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '28px', fontWeight: 700, color: '#fff', margin: 0 }}>KinetiMap</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '16px', marginTop: '8px', marginBottom: 0 }}>
          Patient retention, automated.
        </p>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '32px 0' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {benefits.map(b => (
            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '22px', height: '22px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Check size={13} color="#fff" strokeWidth={2.5} />
              </div>
              <span style={{ color: '#fff', fontSize: '14px' }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginTop: 'auto', paddingTop: '48px' }}>
        Trusted by physio clinics across the UK
      </p>
    </div>
  )
}

// ─── Signup page ──────────────────────────────────────────────────────────────

function Signup() {
  const [form, setForm] = useState({
    fullName: '', clinicName: '', email: '', password: '',
    country: 'GB', whatsapp: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [shaking, setShaking] = useState(false)
  const navigate = useNavigate()
  const { country } = useParams({ strict: false }) as { country: string }

  const set = (key: keyof typeof form) => (val: string) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const triggerShake = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 450)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); triggerShake(); return }
    setLoading(true)

    const { data: existing } = await supabase
      .from('clinics')
      .select('id')
      .eq('whatsapp_number', form.whatsapp)
      .maybeSingle()

    if (existing) {
      toast.error('An account with this WhatsApp number already exists. Please sign in instead.')
      setLoading(false)
      triggerShake()
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          clinic_name: form.clinicName,
          country: form.country,
          whatsapp_number: form.whatsapp,
        },
      },
    })

    if (signUpError) { 
      setLoading(false)
      triggerShake()
      const msg = (signUpError?.message ?? '').toLowerCase()
      if (msg.includes('already registered') || msg.includes('already exists')) {
        toast.error('An account with this email already exists. Please sign in instead.', {
          action: {
            label: 'Sign in →',
            onClick: () => navigate({ to: '/$country/login', params: { country } as any })
          }
        })
        return
      }
      setError(signUpError.message)
      return 
    }
    if (data.session) navigate({ to: '/$country/onboarding', params: { country } as any })
    else { setSuccess(true); setLoading(false) }
  }

  if (success) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#fff' }}>
        <LeftPanel />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px' }}>
          <div className="auth-card-in" style={{ width: '100%', maxWidth: '380px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%', padding: '40px', maxWidth: '320px', margin: '0 auto' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Check size={28} color="#0F6E56" strokeWidth={2.5} />
              </div>
              <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '20px', fontWeight: 700, color: '#006D77', marginBottom: '8px' }}>Check your email</h2>
              <p style={{ color: '#888', fontSize: '14px', lineHeight: 1.6 }}>
                We sent a confirmation link to <strong style={{ color: '#2C1A12' }}>{form.email}</strong>.
                Click it to activate your account.
              </p>
              <Link to="/$country/login" params={{ country } as any} style={{ display: 'block', marginTop: '20px', color: '#006D77', fontSize: '13px', textDecoration: 'none', fontWeight: 500 }}>
                ← Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fff' }}>
      <LeftPanel />

      {/* Right panel */}
      <div style={{
        flex: 1, background: '#fff', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '48px 40px',
        overflowY: 'auto',
      }}>
        <div
          className={`auth-card-in ${shaking ? 'shake' : ''}`}
          style={{ width: '100%', maxWidth: '380px' }}
        >
          <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '22px', fontWeight: 700, color: '#2C1A12', margin: '0 0 4px' }}>
            Create your account
          </h2>
          <p style={{ color: '#888', fontSize: '14px', margin: '0 0 6px' }}>Free 14-day trial · No credit card</p>
          <p style={{ color: '#888', fontSize: '12px', fontStyle: 'italic', margin: '0 0 28px' }}>This account is for physiotherapy clinic owners only.</p>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', color: '#C0392B', fontSize: '13px', marginBottom: '14px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Row 1: Full name + Clinic name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <AuthInput icon={User} placeholder="Full name" value={form.fullName} onChange={set('fullName')} />
              <AuthInput icon={Building2} placeholder="Clinic name" value={form.clinicName} onChange={set('clinicName')} />
            </div>

            <AuthInput icon={Mail} type="email" placeholder="Email address" value={form.email} onChange={set('email')} />
            <PasswordInput value={form.password} onChange={set('password')} />

            {/* Phone Number Input */}
            <div>
              <PhoneInput 
                value={form.whatsapp} 
                onChange={set('whatsapp')} 
                onCountryChange={c => setForm(prev => ({ ...prev, country: c || 'Unknown' }))}
                placeholder="WhatsApp number"
                defaultCountry={country ? country.toUpperCase() : 'GB'}
                className="w-full bg-[#F7F9FA] focus-within:bg-[#EDF6F9] px-[14px] rounded-[10px] h-[45px] transition-colors box-border"
              />
              <p style={{ fontSize: '11px', color: '#bbb', margin: '4px 0 0 4px' }}>WhatsApp number for verification</p>
            </div>

            <SubmitButton loading={loading} label="Create free account →" />
          </form>

          <p style={{ textAlign: 'center', fontSize: '11px', color: '#bbb', marginTop: '14px', lineHeight: 1.5 }}>
            By signing up you agree to our{' '}
            <a href="#" style={{ color: '#006D77', textDecoration: 'none' }}>Terms</a>
            {' '}and{' '}
            <a href="#" style={{ color: '#006D77', textDecoration: 'none' }}>Privacy Policy</a>.
          </p>

          <p style={{ textAlign: 'center', fontSize: '13px', color: '#888', marginTop: '10px' }}>
            Already have an account?{' '}
            <Link to="/$country/login" params={{ country } as any} style={{ color: '#006D77', fontWeight: 500, textDecoration: 'none' }}>Sign in →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
