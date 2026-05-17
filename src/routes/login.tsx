import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Lock, Eye, EyeOff, Check } from 'lucide-react'

export const Route = createFileRoute('/login')({
  component: Login,
})

// ─── Shared components ────────────────────────────────────────────────────────

function AuthInput({
  icon: Icon, type = 'text', placeholder, value, onChange,
}: {
  icon: React.ElementType; type?: string; placeholder: string
  value: string; onChange: (v: string) => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <Icon size={15} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#006D77', pointerEvents: 'none' }} />
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          background: focused ? '#EDF6F9' : '#F7F9FA', border: 'none', borderRadius: '10px',
          padding: '12px 14px 12px 40px', fontSize: '14px', color: '#32323f',
          width: '100%', outline: 'none', transition: 'background 0.2s ease', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

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
          padding: '12px 40px 12px 40px', fontSize: '14px', color: '#32323f',
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
      {loading ? 'Please wait…' : label}
    </button>
  )
}

// ─── Left panel ───────────────────────────────────────────────────────────────

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

// ─── Login page ───────────────────────────────────────────────────────────────

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [shaking, setShaking] = useState(false)
  const navigate = useNavigate()
    const triggerShake = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 450)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); triggerShake() }
    else navigate({ to: '/dashboard' })
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fff' }}>
      <LeftPanel />

      {/* Right panel */}
      <div style={{
        flex: 1, background: '#fff', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '48px 40px',
      }}>
        <div
          className={`auth-card-in ${shaking ? 'shake' : ''}`}
          style={{ width: '100%', maxWidth: '380px' }}
        >
          <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '22px', fontWeight: 700, color: '#32323f', margin: '0 0 4px' }}>
            Welcome back
          </h2>
          <p style={{ color: '#888', fontSize: '14px', margin: '0 0 28px' }}>Sign in to continue</p>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', color: '#C0392B', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <AuthInput icon={Mail} type="email" placeholder="Email address" value={email} onChange={setEmail} />

            <div>
              <PasswordInput value={password} onChange={setPassword} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <a href="#" style={{ fontSize: '12px', color: '#006D77', textDecoration: 'none' }}>Forgot password?</a>
              </div>
            </div>

            <SubmitButton loading={loading} label="Sign In" />
          </form>

          <p style={{ textAlign: 'center', fontSize: '13px', color: '#888', marginTop: '20px' }}>
            Don't have an account?{' '}
            <Link to="/signup"  style={{ color: '#006D77', fontWeight: 500, textDecoration: 'none' }}>Sign up →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
