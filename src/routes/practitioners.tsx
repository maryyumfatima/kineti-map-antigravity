import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Helmet } from 'react-helmet-async'
import {
  Users,
  UserPlus,
  Trash2,
  X,
  Mail,
  Shield,
  Crown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/practitioners')({
  component: PractitionersPage,
})

// ─── Types ──────────────────────────────────────────────────────────────────

type MemberRole = 'owner' | 'practitioner' | 'receptionist'
type MemberStatus = 'pending' | 'active'

type ClinicMember = {
  id: string
  clinic_id: string
  user_id: string | null
  role: MemberRole
  invited_email: string | null
  status: MemberStatus
  created_at: string
}

type ClinicInfo = {
  max_practitioners: number
  subscription_plan: string | null
}

// ─── Plan limits ─────────────────────────────────────────────────────────────

const PLAN_LIMITS: Record<string, number> = {
  trial: 1,
  essentials: 1,
  growth: 3,
  scale: 8,
  enterprise: 999,
}

function getPlanLimit(plan: string | null, maxPractitioners: number): number {
  if (maxPractitioners > 1) return maxPractitioners
  return PLAN_LIMITS[plan ?? 'trial'] ?? 1
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const roleLabel: Record<MemberRole, string> = {
  owner: 'Owner',
  practitioner: 'Practitioner',
  receptionist: 'Receptionist',
}

const roleIcon: Record<MemberRole, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  practitioner: Users,
  receptionist: Shield,
}

const roleColor: Record<MemberRole, string> = {
  owner: 'text-amber-600 bg-amber-50 border-amber-200',
  practitioner: 'text-primary bg-primary/10 border-primary/20',
  receptionist: 'text-purple-600 bg-purple-50 border-purple-200',
}

function getInitials(email: string | null): string {
  if (!email) return '?'
  const name = email.split('@')[0]
  return name.charAt(0).toUpperCase()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm bg-white transition-all'
const labelCls = 'block text-sm font-medium text-text mb-1.5'

// ─── Page ─────────────────────────────────────────────────────────────────────

function PractitionersPage() {
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo | null>(null)
  const [members, setMembers] = useState<ClinicMember[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Invite modal state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'practitioner' | 'receptionist'>('practitioner')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      // Get clinic_id via clinic_users (existing pattern)
      const { data: cu } = await supabase
        .from('clinic_users')
        .select('clinic_id')
        .eq('auth_user_id', user.id)
        .single()
      if (!cu) return
      setClinicId(cu.clinic_id)

      // Fetch clinic info
      const { data: clinic } = await supabase
        .from('clinics')
        .select('max_practitioners, subscription_plan')
        .eq('id', cu.clinic_id)
        .single()
      if (clinic) setClinicInfo(clinic)

      // Fetch clinic_members
      const { data: membersData, error: membersError } = await supabase
        .from('clinic_members')
        .select('*')
        .eq('clinic_id', cu.clinic_id)
        .order('created_at', { ascending: true })

      if (membersError) throw membersError
      if (membersData) setMembers(membersData)
    } catch (e) {
      console.error('[Practitioners] fetch error:', e)
      toast.error('Failed to load team members')
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clinicId || !inviteEmail.trim()) return

    const limit = getPlanLimit(clinicInfo?.subscription_plan ?? null, clinicInfo?.max_practitioners ?? 1)
    const activePractitioners = members.filter(
      m => m.role === 'practitioner' && m.status === 'active'
    ).length

    if (activePractitioners >= limit) {
      toast.error(
        `You've reached your plan limit of ${limit} practitioner${limit === 1 ? '' : 's'}. Upgrade to add more.`
      )
      return
    }

    // Check if already invited
    const alreadyExists = members.some(
      m => m.invited_email?.toLowerCase() === inviteEmail.trim().toLowerCase()
    )
    if (alreadyExists) {
      toast.error('This email has already been invited.')
      return
    }

    setInviting(true)
    try {
      const { error } = await supabase.from('clinic_members').insert([
        {
          clinic_id: clinicId,
          user_id: null,
          role: inviteRole,
          invited_email: inviteEmail.trim().toLowerCase(),
          status: 'pending',
        },
      ])

      if (error) throw error

      toast.success(`Invite sent to ${inviteEmail.trim()}`)
      setInviteEmail('')
      setInviteRole('practitioner')
      setIsInviteOpen(false)
      fetchAll()
    } catch (e: any) {
      toast.error(`Failed to invite: ${e.message || 'Unknown error'}`)
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (member: ClinicMember) => {
    if (member.role === 'owner') {
      toast.error('Cannot remove the owner.')
      return
    }
    const label = member.invited_email ?? member.user_id ?? 'this member'
    if (!confirm(`Remove ${label} from your clinic?`)) return

    setRemovingId(member.id)
    try {
      const { error } = await supabase.from('clinic_members').delete().eq('id', member.id)
      if (error) throw error
      toast.success('Member removed')
      setMembers(prev => prev.filter(m => m.id !== member.id))
    } catch (e: any) {
      toast.error(`Failed to remove: ${e.message}`)
    } finally {
      setRemovingId(null)
    }
  }

  const limit = getPlanLimit(clinicInfo?.subscription_plan ?? null, clinicInfo?.max_practitioners ?? 1)
  const activePractitioners = members.filter(m => m.role === 'practitioner' && m.status === 'active').length
  const slotsUsed = activePractitioners
  const slotsTotal = limit
  const slotsAvailable = slotsTotal - slotsUsed
  const isFull = slotsAvailable <= 0

  return (
    <DashboardLayout>
      <Helmet>
        <title>Practitioners | KinetiMap</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-3xl mx-auto">
        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-sm text-text/50 mb-6">
          <Link to="/settings" className="hover:text-primary transition-colors">
            Settings
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-text font-medium">Practitioners</span>
        </nav>

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-bold text-primary font-bricolage">Practitioners</h1>
            <p className="text-sm text-text/50 mt-0.5">Manage your clinic team and invite new members.</p>
          </div>

          <button
            id="invite-practitioner-btn"
            onClick={() => setIsInviteOpen(true)}
            disabled={isFull}
            title={isFull ? `Limit of ${slotsTotal} practitioner${slotsTotal === 1 ? '' : 's'} reached` : undefined}
            className="flex items-center gap-2 bg-primary hover:opacity-90 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            Invite Practitioner
          </button>
        </div>

        {/* ── Slot Usage Banner ── */}
        <div className="bg-card border border-border rounded-xl px-5 py-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">
                {slotsUsed} of {slotsTotal === 999 ? 'Unlimited' : slotsTotal} practitioner slot{slotsTotal === 1 ? '' : 's'} used
              </p>
              <p className="text-xs text-text/50 mt-0.5">
                Plan:{' '}
                <span className="capitalize font-medium text-text/70">
                  {clinicInfo?.subscription_plan ?? 'Trial'}
                </span>
                {' '}
                {slotsTotal !== 999 && (
                  <Link to="/billing" className="text-primary hover:underline font-medium ml-1">
                    Upgrade to add more →
                  </Link>
                )}
              </p>
            </div>
          </div>

          {/* Slot pills */}
          <div className="flex gap-1.5">
            {Array.from({ length: Math.min(slotsTotal, 10) }).map((_, i) => (
              <div
                key={i}
                className={`h-2 w-6 rounded-full transition-all ${
                  i < slotsUsed ? 'bg-primary' : 'bg-border'
                }`}
              />
            ))}
            {slotsTotal > 10 && (
              <span className="text-xs text-text/40 font-medium self-center">+{slotsTotal - 10}</span>
            )}
            {slotsTotal === 999 && (
              <span className="text-xs text-primary font-medium self-center">∞</span>
            )}
          </div>
        </div>

        {/* ── Members List ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-border animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-border rounded animate-pulse" />
                    <div className="h-3 w-24 bg-border rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-primary/30" />
              </div>
              <h3 className="text-base font-bold text-text font-bricolage mb-1">No team members yet</h3>
              <p className="text-sm text-text/50 mb-6 max-w-xs">
                Invite practitioners and receptionists to collaborate on your clinic.
              </p>
              <button
                onClick={() => setIsInviteOpen(true)}
                className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Invite First Member
              </button>
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div className="px-5 py-3 bg-background/50 border-b border-border grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                <span className="text-xs font-medium text-text/50 uppercase tracking-wider">Member</span>
                <span className="text-xs font-medium text-text/50 uppercase tracking-wider">Role</span>
                <span className="text-xs font-medium text-text/50 uppercase tracking-wider">Status</span>
                <span className="w-8" />
              </div>

              {/* Members rows */}
              <div className="divide-y divide-border">
                {members.map(member => {
                  const RoleIcon = roleIcon[member.role]
                  const isOwner = member.role === 'owner'
                  const isRemoving = removingId === member.id

                  return (
                    <div
                      key={member.id}
                      className="px-5 py-4 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center hover:bg-background/40 transition-colors"
                    >
                      {/* Member info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                          {getInitials(member.invited_email)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text truncate">
                            {member.invited_email ?? `User ${member.user_id?.slice(0, 8)}`}
                          </p>
                          <p className="text-xs text-text/40 mt-0.5 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            Joined {formatDate(member.created_at)}
                          </p>
                        </div>
                      </div>

                      {/* Role badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap ${roleColor[member.role]}`}
                      >
                        <RoleIcon className="w-3 h-3" />
                        {roleLabel[member.role]}
                      </span>

                      {/* Status badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap ${
                          member.status === 'active'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {member.status === 'active' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {member.status === 'active' ? 'Active' : 'Pending'}
                      </span>

                      {/* Remove button */}
                      {isOwner ? (
                        <div className="w-8 h-8" />
                      ) : (
                        <button
                          id={`remove-member-${member.id}`}
                          onClick={() => handleRemove(member)}
                          disabled={isRemoving}
                          title="Remove member"
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-alert/10 hover:border-alert/30 text-text/30 hover:text-alert transition-all disabled:opacity-40"
                        >
                          {isRemoving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Access Control Info ── */}
        <div className="mt-4 bg-background border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-text flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Access Control
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                role: 'Owner',
                icon: Crown,
                color: 'text-amber-600',
                bg: 'bg-amber-50 border-amber-100',
                desc: 'Full access — sees all patients, sessions, revenue & settings.',
              },
              {
                role: 'Practitioner',
                icon: Users,
                color: 'text-primary',
                bg: 'bg-primary/5 border-primary/10',
                desc: 'Sees only their own assigned patients and sessions.',
              },
              {
                role: 'Receptionist',
                icon: Shield,
                color: 'text-purple-600',
                bg: 'bg-purple-50 border-purple-100',
                desc: 'Bookings and patient list only — no clinical notes.',
              },
            ].map(item => {
              const Icon = item.icon
              return (
                <div
                  key={item.role}
                  className={`rounded-xl border p-3.5 ${item.bg}`}
                >
                  <div className={`flex items-center gap-1.5 mb-1.5 font-bold text-sm ${item.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {item.role}
                  </div>
                  <p className="text-xs text-text/60 leading-relaxed">{item.desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Invite Limit Warning ── */}
        {isFull && (
          <div className="mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700">Practitioner limit reached</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Your {clinicInfo?.subscription_plan ?? 'current'} plan allows {slotsTotal} practitioner
                {slotsTotal === 1 ? '' : 's'}.{' '}
                <Link to="/billing" className="underline font-medium">
                  Upgrade your plan
                </Link>{' '}
                to invite more team members.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ══ Invite Modal ══ */}
      {isInviteOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => {
            if (e.target === e.currentTarget) setIsInviteOpen(false)
          }}
        >
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
            {/* Modal header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-text font-bricolage">Invite Team Member</h3>
                  <p className="text-xs text-text/50 mt-0.5">
                    {slotsAvailable > 0
                      ? `${slotsAvailable} slot${slotsAvailable === 1 ? '' : 's'} remaining`
                      : 'Limit reached'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="text-text/40 hover:text-text transition-colors p-1 rounded-lg hover:bg-background"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Limit guard */}
            {isFull ? (
              <div className="p-6">
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-700">Slot limit reached</p>
                    <p className="text-xs text-amber-600 mt-1">
                      Your plan allows {slotsTotal} practitioner{slotsTotal === 1 ? '' : 's'}. Please upgrade to invite more.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setIsInviteOpen(false)}
                    className="text-sm text-text/70 px-4 py-2 rounded-lg hover:bg-background font-medium"
                  >
                    Cancel
                  </button>
                  <Link
                    to="/billing"
                    className="bg-primary hover:opacity-90 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                  >
                    Upgrade Plan →
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInvite}>
                <div className="p-6 space-y-4">
                  {/* Email */}
                  <div>
                    <label htmlFor="invite-email" className={labelCls}>
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/30" />
                      <input
                        id="invite-email"
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="colleague@example.com"
                        className={`${inputCls} pl-9`}
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-text/40 mt-1.5">
                      They'll receive an invitation to join your clinic when email sending is enabled.
                    </p>
                  </div>

                  {/* Role */}
                  <div>
                    <label htmlFor="invite-role" className={labelCls}>
                      Role
                    </label>
                    <select
                      id="invite-role"
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as 'practitioner' | 'receptionist')}
                      className={inputCls}
                    >
                      <option value="practitioner">Practitioner — sees their patients & sessions</option>
                      <option value="receptionist">Receptionist — bookings & patient list only</option>
                    </select>
                  </div>

                  {/* Role description */}
                  <div
                    className={`rounded-lg border p-3 text-xs ${
                      inviteRole === 'practitioner'
                        ? 'bg-primary/5 border-primary/20 text-primary'
                        : 'bg-purple-50 border-purple-200 text-purple-700'
                    }`}
                  >
                    {inviteRole === 'practitioner' ? (
                      <>
                        <strong>Practitioner access:</strong> Can view and manage their own assigned patients,
                        sessions, and SOAP notes. Cannot access other practitioners' patients.
                      </>
                    ) : (
                      <>
                        <strong>Receptionist access:</strong> Can view all patient names and manage bookings.
                        Cannot view clinical SOAP notes or revenue data.
                      </>
                    )}
                  </div>
                </div>

                {/* Modal footer */}
                <div className="px-6 pb-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(false)}
                    className="text-sm text-text/70 px-4 py-2.5 rounded-xl hover:bg-background font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id="send-invite-btn"
                    type="submit"
                    disabled={inviting || !inviteEmail.trim()}
                    className="flex items-center gap-2 bg-primary hover:opacity-90 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {inviting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Send Invite
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
