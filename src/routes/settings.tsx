import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import {
  Lock, Sparkles, MapPin, ShieldCheck, AlertTriangle, X,
  Download, FileText, LogOut, Trash2
} from 'lucide-react'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifPrefs = {
  feedback_alert: boolean
  lapsed_alert: boolean
  noshow_whatsapp: boolean
  weekly_summary: boolean
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const card = 'bg-card border border-border rounded-xl p-6'
const inputCls = 'w-full px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm bg-white disabled:bg-background disabled:text-text/40 disabled:cursor-not-allowed'
const labelCls = 'block text-sm font-medium text-text mb-1'
const saveBtnCls = 'bg-primary hover:opacity-90 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60'

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={!disabled ? onChange : undefined}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked && !disabled ? 'bg-primary' : 'bg-gray-300'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
    </button>
  )
}

// ─── Section heading ─────────────────────────────────────────────────────────

function SectionTitle({ children, badge }: { children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <h2 className="font-bold text-text font-bricolage text-base">{children}</h2>
      {badge}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SettingsPage() {
  const navigate = useNavigate()

  // Auth / clinic state

  const [clinicId, setClinicId] = useState<string | null>(null)

  // Section 1: Account
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)
  const [pwdModal, setPwdModal] = useState(false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)

  // Section 2: Clinic
  const [clinicName, setClinicName] = useState('')
  const [country, setCountry] = useState('United Kingdom')
  const [timezone, setTimezone] = useState('Europe/London')
  const [numPractitioners, setNumPractitioners] = useState('1')
  const [savingClinic, setSavingClinic] = useState(false)

  // Section 3: Notifications
  const [notifs, setNotifs] = useState<NotifPrefs>({
    feedback_alert: true,
    lapsed_alert: true,
    noshow_whatsapp: false,
    weekly_summary: true,
  })
  const [savingNotifs, setSavingNotifs] = useState(false)

  // Section 7: Danger Zone
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setEmail(user.email ?? '')
      setFullName(user.user_metadata?.full_name ?? '')

      const { data: cu } = await supabase
        .from('clinic_users').select('clinic_id').eq('auth_user_id', user.id).single()
      if (!cu) return
      setClinicId(cu.clinic_id)

      const { data: clinic } = await supabase
        .from('clinics')
        .select('name, country, timezone, num_practitioners, notification_prefs')
        .eq('id', cu.clinic_id)
        .single()

      if (clinic) {
        setClinicName(clinic.name ?? '')
        setCountry(clinic.country ?? 'United Kingdom')
        setTimezone(clinic.timezone ?? 'Europe/London')
        setNumPractitioners(clinic.num_practitioners ? String(clinic.num_practitioners) : '1')
        if (clinic.notification_prefs) setNotifs(clinic.notification_prefs)
      }
    } catch (e) {
      console.error('[Settings] fetch error:', e)
    }
  }

  // ── Save account ────────────────────────────────────────────────────────────
  const handleSaveAccount = async () => {
    setSavingAccount(true)
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } })
      if (error) throw error
      toast.success('Account updated')
    } catch (e: any) {
      toast.error(`Failed: ${e?.message}`)
    } finally {
      setSavingAccount(false)
    }
  }

  // ── Change password ─────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (newPwd !== confirmPwd) { toast.error('Passwords do not match'); return }
    if (newPwd.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setSavingPwd(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd })
      if (error) throw error
      toast.success('Password updated successfully')
      setPwdModal(false)
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch (e: any) {
      toast.error(`Failed: ${e?.message}`)
    } finally {
      setSavingPwd(false)
    }
  }

  // ── Save clinic ─────────────────────────────────────────────────────────────
  const handleSaveClinic = async () => {
    if (!clinicId) return
    setSavingClinic(true)
    try {
      const { error } = await supabase.from('clinics').update({
        name: clinicName,
        country,
        timezone,
        num_practitioners: Number(numPractitioners.replace('+', '')) || 1,
      }).eq('id', clinicId)
      if (error) throw error
      toast.success('Clinic settings saved')
    } catch (e: any) {
      toast.error(`Failed: ${e?.message}`)
    } finally {
      setSavingClinic(false)
    }
  }

  // ── Save notifications ──────────────────────────────────────────────────────
  const handleSaveNotifs = async () => {
    if (!clinicId) return
    setSavingNotifs(true)
    try {
      const { error } = await supabase.from('clinics')
        .update({ notification_prefs: notifs }).eq('id', clinicId)
      if (error) throw error
      toast.success('Notification preferences saved')
    } catch (e: any) {
      toast.error(`Failed: ${e?.message}`)
    } finally {
      setSavingNotifs(false)
    }
  }

  // ── Sign out all devices ────────────────────────────────────────────────────
  const handleSignOutAll = async () => {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  // ── Delete account ──────────────────────────────────────────────────────────
  const handleDeleteAccount = () => {
    if (deleteInput !== 'DELETE') { toast.error('Please type DELETE to confirm'); return }
    toast.success('Deletion request submitted. Our team will contact you within 48 hours.')
    setDeleteModal(false)
    setDeleteInput('')
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        <h1 className="text-[28px] font-bold text-primary font-bricolage">Settings</h1>

        {/* ══════════ S1: Account ══════════ */}
        <div className={card}>
          <SectionTitle>Account</SectionTitle>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Full name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} placeholder="Jane Smith" />
            </div>
            <div>
              <label className={labelCls}>Email address</label>
              <input type="email" value={email} disabled className={inputCls} />
              <p className="text-xs text-text/40 mt-1">Email cannot be changed here — contact support.</p>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button onClick={handleSaveAccount} disabled={savingAccount} className={saveBtnCls}>
                {savingAccount ? 'Saving…' : 'Save Account'}
              </button>
              <button
                onClick={() => setPwdModal(true)}
                className="flex items-center gap-1.5 text-sm text-text/70 border border-border px-4 py-2 rounded-lg hover:bg-background transition-colors font-medium"
              >
                <Lock className="w-3.5 h-3.5" /> Change Password
              </button>
            </div>
          </div>
        </div>

        {/* ══════════ S2: Clinic ══════════ */}
        <div className={card}>
          <SectionTitle>Clinic</SectionTitle>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Clinic name</label>
              <input type="text" value={clinicName} onChange={e => setClinicName(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Country</label>
                <select value={country} onChange={e => setCountry(e.target.value)} className={inputCls}>
                  {['United Kingdom', 'Australia', 'Germany', 'France', 'Netherlands', 'Pakistan', 'Other'].map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Timezone</label>
                <select value={timezone} onChange={e => setTimezone(e.target.value)} className={inputCls}>
                  {['Europe/London', 'Australia/Sydney', 'Europe/Berlin', 'Europe/Paris', 'Asia/Karachi', 'UTC'].map(tz => (
                    <option key={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Number of practitioners</label>
              <select value={numPractitioners} onChange={e => setNumPractitioners(e.target.value)} className={`${inputCls} max-w-xs`}>
                {['1', '2', '3', '4', '5+'].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={handleSaveClinic} disabled={savingClinic} className={saveBtnCls}>
              {savingClinic ? 'Saving…' : 'Save Clinic'}
            </button>
          </div>
        </div>

        {/* ══════════ S3: Notifications ══════════ */}
        <div className={card}>
          <SectionTitle>Notifications</SectionTitle>
          <div className="space-y-4 mb-5">
            {([
              { key: 'feedback_alert', label: 'Email me when feedback score < 6' },
              { key: 'lapsed_alert', label: 'Email me when a patient becomes lapsed' },
              { key: 'noshow_whatsapp', label: 'WhatsApp alert for no-shows' },
              { key: 'weekly_summary', label: 'Weekly summary email every Monday' },
            ] as { key: keyof NotifPrefs; label: string }[]).map(item => (
              <div key={item.key} className="flex items-center justify-between gap-4">
                <span className="text-sm text-text">{item.label}</span>
                <Toggle
                  checked={notifs[item.key]}
                  onChange={() => setNotifs(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                />
              </div>
            ))}
          </div>
          <button onClick={handleSaveNotifs} disabled={savingNotifs} className={saveBtnCls}>
            {savingNotifs ? 'Saving…' : 'Save Notifications'}
          </button>
        </div>

        {/* ══════════ S4: AI Features ══════════ */}
        <div className={card}>
          <SectionTitle
            badge={<span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">Pro & Group plans only</span>}
          >
            <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" />AI Features</span>
          </SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: 'AI SOAP Notes', desc: 'Auto-generate session notes after Mark Complete', badge: 'Team+', badgeColor: 'bg-primary/10 text-primary border-primary/20' },
              { title: 'AI Schedule Optimizer', desc: 'AI suggests your best availability based on booking patterns', badge: 'Group', badgeColor: 'bg-purple-100 text-purple-700 border-purple-200' },
              { title: 'AI Reactivation Predictor', desc: 'Identifies patients most likely to lapse before they do', badge: 'Group', badgeColor: 'bg-purple-100 text-purple-700 border-purple-200' },
              { title: 'AI Insights', desc: 'Revenue and retention pattern analysis', badge: 'Group', badgeColor: 'bg-purple-100 text-purple-700 border-purple-200' },
            ].map(f => (
              <div key={f.title} className="border border-border rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold text-text">{f.title}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${f.badgeColor}`}>{f.badge}</span>
                    </div>
                    <p className="text-xs text-text/60">{f.desc}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <Link to="/billing" className="text-xs text-primary hover:underline font-medium">Upgrade to unlock →</Link>
                  <Toggle checked={false} onChange={() => {}} disabled />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════ S5: Multi-Location ══════════ */}
        <div className={card}>
          <SectionTitle
            badge={<span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">Group plan</span>}
          >
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary" />Clinic Locations</span>
          </SectionTitle>
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-text">Primary Clinic (Location 1)</span>
              </div>
              <span className="text-xs font-semibold bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">Active</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled
              title="Upgrade to Group plan to add more locations"
              className="flex items-center gap-2 border border-border text-text/40 text-sm font-medium px-4 py-2 rounded-lg cursor-not-allowed"
            >
              <MapPin className="w-4 h-4" /> Add Location
            </button>
            <p className="text-xs text-text/50">Upgrade to Group plan to add locations</p>
          </div>
          <p className="text-xs text-text/50 mt-3">Manage multiple clinic branches from one account.</p>
        </div>

        {/* ══════════ S6: Data & Privacy ══════════ */}
        <div className={card}>
          <SectionTitle>
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-primary" />Data & Privacy</span>
          </SectionTitle>
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={() => toast.info('CSV export coming soon.')}
              className="flex items-center gap-2 border text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ borderColor: '#D9B29C', color: '#B88B71', backgroundColor: '#D9B29C18' }}
            >
              <FileText className="w-4 h-4" /> Export Patient Data (CSV)
            </button>
            <button
              onClick={() => toast.info('PDF download coming soon.')}
              className="flex items-center gap-2 border border-border text-text text-sm font-medium px-4 py-2 rounded-lg hover:bg-background transition-colors"
            >
              <Download className="w-4 h-4" /> Download My Data (PDF)
            </button>
          </div>
          <p className="text-xs text-text/50 leading-relaxed bg-background rounded-lg px-4 py-3 border border-border">
            🔒 Your data is stored in EU servers and protected under UK GDPR.
            Patients can request deletion at any time.
          </p>
        </div>

        {/* ══════════ S7: Danger Zone ══════════ */}
        <div className="border-2 border-alert/30 bg-alert/5 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="w-4 h-4 text-alert" />
            <h2 className="font-bold text-alert font-bricolage text-base">Danger Zone</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3 border border-border bg-card rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-text">Sign out all devices</p>
                <p className="text-xs text-text/50">Ends all active sessions immediately</p>
              </div>
              <button
                onClick={handleSignOutAll}
                className="flex items-center gap-2 border border-border text-text text-sm font-medium px-4 py-2 rounded-lg hover:bg-background transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out All
              </button>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-3 border border-alert/20 bg-card rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-alert">Delete Account</p>
                <p className="text-xs text-text/50">Permanently remove your account and all data</p>
              </div>
              <button
                onClick={() => setDeleteModal(true)}
                className="flex items-center gap-2 bg-alert hover:opacity-90 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ Change Password Modal ══════════ */}
      {pwdModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-xl">
            <div className="p-5 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-text font-bricolage">Change Password</h3>
              <button onClick={() => setPwdModal(false)} className="text-text/50 hover:text-text"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className={labelCls}>Current password</label>
                <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} className={inputCls} placeholder="••••••••" />
              </div>
              <div>
                <label className={labelCls}>New password</label>
                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} className={inputCls} placeholder="••••••••" />
              </div>
              <div>
                <label className={labelCls}>Confirm new password</label>
                <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className={inputCls} placeholder="••••••••" />
              </div>
            </div>
            <div className="p-5 border-t border-border flex justify-end gap-3">
              <button onClick={() => setPwdModal(false)} className="text-sm text-text/70 px-4 py-2 rounded-lg hover:bg-background font-medium">Cancel</button>
              <button onClick={handleChangePassword} disabled={savingPwd} className={saveBtnCls}>
                {savingPwd ? 'Saving…' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Delete Account Modal ══════════ */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-xl border border-alert/20">
            <div className="p-5 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-alert font-bricolage flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Delete Account
              </h3>
              <button onClick={() => { setDeleteModal(false); setDeleteInput('') }} className="text-text/50 hover:text-text"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-text/70 leading-relaxed">
                This action cannot be undone. All your clinic data, patients, and sessions will be permanently deleted.
              </p>
              <div>
                <label className={labelCls}>Type <span className="font-mono font-bold text-alert">DELETE</span> to confirm</label>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  className={inputCls}
                  placeholder="DELETE"
                />
              </div>
            </div>
            <div className="p-5 border-t border-border flex justify-end gap-3">
              <button onClick={() => { setDeleteModal(false); setDeleteInput('') }} className="text-sm text-text/70 px-4 py-2 rounded-lg hover:bg-background font-medium">Cancel</button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'DELETE'}
                className="bg-alert hover:opacity-90 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
