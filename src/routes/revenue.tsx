import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import {
  CheckCircle, DollarSign, FileText, Plus, Send, Eye, X,
  ChevronRight, Loader2, Receipt, Printer, Building2, ExternalLink,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { formatLocalTime, getZonedDate } from '../lib/date'
import { PatientSelector } from '../components/PatientSelector'

export const Route = createFileRoute('/revenue')({
  component: RevenuePage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type LedgerRow = {
  id: string
  booking_id: string
  patient_id: string
  amount: number
  currency: string
  payment_status: 'paid' | 'unpaid'
  recorded_at: string
  patients?: { full_name: string }
  bookings?: { appointment_time: string; appointment_type: string }
}

type MonthlySummary = {
  month: string
  sessions: number
  collected: number
  unpaid: number
  net: number
}

type ChartDatum = {
  type: string
  total: number
}

type InvoiceRow = {
  id: string
  invoice_number: string
  patient_id: string | null
  booking_id: string | null
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  subtotal: number
  tax_amount: number
  total_amount: number
  currency: string
  due_date: string | null
  notes: string | null
  created_at: string
  manual_patient_name: string | null
  payment_link_token?: string | null
  patients?: { full_name: string | null; phone_number?: string | null }
  patient_insurance_name?: string | null
  patient_policy_number?: string | null
  override_therapist_name?: string | null
  override_therapist_email?: string | null
  bookings?: {
    appointment_time: string | null
    clinic_users?: { name: string | null; email: string | null } | null
  } | null
}

type InvoiceItem = {
  id: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
}

type ClinicInfo = {
  id: string
  name: string
  logo_url: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  brand_color: string | null
  currency: string
  is_vat_registered?: boolean
  vat_number?: string | null
  vat_rate?: number
  payment_terms_days?: number
}

type PatientResult = {
  id: string
  full_name: string | null
  phone_number: string | null
}

type CompletedBooking = {
  id: string
  appointment_time: string | null
  appointment_type: string | null
  appointment_price: number | null
  clinic_users: { name: string | null; email: string | null } | null
}

type InvoiceFormState = {
  description: string
  amount: string
  due_date: string
  patient_insurance_name?: string
  patient_policy_number?: string
  override_therapist_name?: string
  override_therapist_email?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(n: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(n)
}

const fmt = (n: number) => fmtCurrency(n, 'GBP')

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function last6Months(): { label: string; year: number; month: number }[] {
  const result = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({ label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear(), month: d.getMonth() })
  }
  return result
}

const TYPE_LABELS: Record<string, string> = {
  initial: 'Initial', follow_up: 'Follow-up', assessment: 'Assessment', discharge: 'Discharge',
}

const APPT_TYPE_LABELS: Record<string, string> = {
  initial: 'Initial Assessment',
  follow_up: 'Follow-up',
  assessment: 'Assessment',
  discharge: 'Discharge Session',
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-text/10 text-text/60 border-text/20' },
  sent:      { label: 'Sent',      cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid:      { label: 'Paid',      cls: 'bg-green-50 text-green-700 border-green-200' },
  overdue:   { label: 'Overdue',   cls: 'bg-alert/10 text-alert border-alert/20' },
  cancelled: { label: 'Cancelled', cls: 'bg-text/5 text-text/40 border-text/10' },
}

function defaultDueDate(days = 30) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function RevenuePage() {
  // ── existing state ────────────────────────────────────────────────────────
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [clinicCurrency, setClinicCurrency] = useState('GBP')
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [upcomingCount, setUpcomingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState<string | null>(null)

  // ── clinic compliance settings ────────────────────────────────────────────
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo | null>(null)

  // ── invoice list state ────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)

  // ── new invoice modal state ───────────────────────────────────────────────
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1)
  const [invoiceType, setInvoiceType] = useState<'booking' | 'manual'>('booking')

  // step 1 — patient selection
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null)

  // step 2 — booking selection
  const [completedBookings, setCompletedBookings] = useState<CompletedBooking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<CompletedBooking | null>(null)

  // step 3 — form
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormState>({
    description: '',
    amount: '',
    due_date: defaultDueDate(),
    patient_insurance_name: '',
    patient_policy_number: '',
  })
  const [manualForm, setManualForm] = useState({
    patient_name: '',
    description: '',
    amount: '',
    due_date: defaultDueDate(),
    notes: '',
    patient_insurance_name: '',
    patient_policy_number: '',
    override_therapist_name: '',
    override_therapist_email: '',
  })
  const [showInsuranceFields, setShowInsuranceFields] = useState(false)
  const [showTherapistOverrides, setShowTherapistOverrides] = useState(false)
  const [submittingInvoice, setSubmittingInvoice] = useState(false)

  // view modal
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceRow | null>(null)
  const [viewingClinic, setViewingClinic] = useState<ClinicInfo | null>(null)
  const [viewingItems, setViewingItems] = useState<InvoiceItem[]>([])
  const [viewLoading, setViewLoading] = useState(false)

  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => { fetchData() }, [])



  // ─── Data fetchers ────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: cu } = await supabase
        .from('clinic_users').select('clinic_id').eq('auth_user_id', user.id).single()
      if (!cu) return
      const cid = cu.clinic_id
      setClinicId(cid)

      const [ledgerRes, upcomingRes, clinicRes] = await Promise.all([
        supabase
          .from('cash_ledger')
          .select('*, patients(full_name), bookings(appointment_time, appointment_type)')
          .eq('clinic_id', cid)
          .order('recorded_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', cid)
          .eq('status', 'upcoming'),
        supabase
          .from('clinics')
          .select('id, name, logo_url, contact_email, contact_phone, contact_address, brand_color, currency, is_vat_registered, vat_number, vat_rate, payment_terms_days')
          .eq('id', cid)
          .single(),
      ])

      if (ledgerRes.error) throw ledgerRes.error
      setLedger(ledgerRes.data ?? [])
      setUpcomingCount(upcomingRes.count ?? 0)
      if (clinicRes.data) {
        setClinicInfo(clinicRes.data as ClinicInfo)
        if (clinicRes.data.currency) setClinicCurrency(clinicRes.data.currency)
      }

      await fetchInvoices(cid)
    } catch {
      toast.error('Failed to load revenue data')
    } finally {
      setLoading(false)
    }
  }

  const fetchInvoices = async (cid: string) => {
    setInvoicesLoading(true)
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, patients(full_name, phone_number), bookings(appointment_time, clinic_users!bookings_completed_by_fkey(name, email))')
        .eq('clinic_id', cid)
        .order('created_at', { ascending: false })
      if (error) throw error
      setInvoices((data ?? []) as InvoiceRow[])
    } catch {
      toast.error('Failed to load invoices')
    } finally {
      setInvoicesLoading(false)
    }
  }

  const openViewInvoice = async (inv: InvoiceRow) => {
    setViewingInvoice(inv)
    setViewingItems([])
    setViewingClinic(null)
    if (!clinicId) return
    setViewLoading(true)
    try {
      const [itemsRes, clinicRes] = await Promise.all([
        supabase
          .from('invoice_items')
          .select('id, description, quantity, unit_price, line_total')
          .eq('invoice_id', inv.id),
        supabase
          .from('clinics')
          .select('id, name, logo_url, contact_email, contact_phone, contact_address, brand_color, currency, is_vat_registered, vat_number, vat_rate, payment_terms_days')
          .eq('id', clinicId)
          .single(),
      ])
      if (itemsRes.data) setViewingItems(itemsRes.data as InvoiceItem[])
      if (clinicRes.data) setViewingClinic(clinicRes.data as ClinicInfo)
    } catch {
      toast.error('Failed to load invoice details')
    } finally {
      setViewLoading(false)
    }
  }



  const fetchCompletedBookings = async (patientId: string) => {
    setBookingsLoading(true)
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, appointment_time, appointment_type, appointment_price, clinic_users!bookings_completed_by_fkey(name, email)')
        .eq('patient_id', patientId)
        .eq('status', 'completed')
        .order('appointment_time', { ascending: false })
      if (error) throw error
      setCompletedBookings(data ?? [])
    } catch {
      toast.error('Failed to load bookings')
    } finally {
      setBookingsLoading(false)
    }
  }

  const handleSelectPatient = (p: PatientResult) => {
    setSelectedPatient(p)
    setSelectedBooking(null)
    setCompletedBookings([])
    setModalStep(2)
    fetchCompletedBookings(p.id)
  }

  const handleSelectBooking = (b: CompletedBooking) => {
    setSelectedBooking(b)
    const typeLabel = APPT_TYPE_LABELS[b.appointment_type ?? ''] ?? b.appointment_type ?? 'Session'
    const dateStr = b.appointment_time
      ? formatLocalTime(b.appointment_time, 'GB', 'MMM d, yyyy', 'Europe/London')
      : ''
    const days = clinicInfo?.payment_terms_days ?? 30
    setInvoiceForm({
      description: `${typeLabel}${dateStr ? ' — ' + dateStr : ''}`,
      amount: b.appointment_price != null ? String(b.appointment_price) : '',
      due_date: defaultDueDate(days),
      patient_insurance_name: '',
      patient_policy_number: '',
      override_therapist_name: b.clinic_users?.name ?? '',
      override_therapist_email: b.clinic_users?.email ?? '',
    })
    setModalStep(3)
  }
  const handleSubmitInvoice = async () => {
    if (!clinicId) return

    if (invoiceType === 'manual') {
      const amount = parseFloat(manualForm.amount)
      if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return }
      if (!manualForm.patient_name.trim()) { toast.error('Patient name is required'); return }
      if (!manualForm.description.trim()) { toast.error('Service description is required'); return }

      const subtotal = amount
      const isVat = clinicInfo?.is_vat_registered ?? false
      const vatRate = clinicInfo?.vat_rate ?? 20
      const taxAmount = isVat ? subtotal * (vatRate / 100) : 0
      const totalAmount = isVat ? subtotal + taxAmount : subtotal

      setSubmittingInvoice(true)
      try {
        // 1. Generate invoice number via RPC
        const { data: invoiceNum, error: rpcError } = await (supabase.rpc as any)(
          'generate_invoice_number',
          { p_clinic_id: clinicId }
        )
        if (rpcError) throw rpcError

        // 2. Insert invoice
        const { data: newInvoice, error: invError } = await supabase
          .from('invoices')
          .insert({
            clinic_id: clinicId,
            patient_id: null,
            booking_id: null,
            manual_patient_name: manualForm.patient_name.trim(),
            invoice_number: invoiceNum,
            status: 'draft',
            subtotal: subtotal,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            currency: clinicCurrency,
            due_date: manualForm.due_date || null,
            notes: manualForm.notes.trim() || null,
            patient_insurance_name: manualForm.patient_insurance_name?.trim() || null,
            patient_policy_number: manualForm.patient_policy_number?.trim() || null,
            override_therapist_name: manualForm.override_therapist_name?.trim() || null,
            override_therapist_email: manualForm.override_therapist_email?.trim() || null,
          })
          .select()
          .single()
        if (invError) throw invError

        // 3. Insert invoice item
        const { error: itemError } = await supabase
          .from('invoice_items')
          .insert({
            invoice_id: newInvoice.id,
            clinic_id: clinicId,
            description: manualForm.description.trim(),
            quantity: 1,
            unit_price: subtotal,
            line_total: subtotal,
          })
        if (itemError) throw itemError

        toast.success(`Invoice ${invoiceNum} created`)
        closeInvoiceModal()
        await fetchInvoices(clinicId)
      } catch (err: any) {
        toast.error(err?.message ?? 'Failed to create invoice')
      } finally {
        setSubmittingInvoice(false)
      }
      return
    }

    if (!selectedPatient) return
    const amount = parseFloat(invoiceForm.amount)
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (!invoiceForm.description.trim()) { toast.error('Description is required'); return }

    const subtotal = amount
    const isVat = clinicInfo?.is_vat_registered ?? false
    const vatRate = clinicInfo?.vat_rate ?? 20
    const taxAmount = isVat ? subtotal * (vatRate / 100) : 0
    const totalAmount = isVat ? subtotal + taxAmount : subtotal

    setSubmittingInvoice(true)
    try {
      // 1. Generate invoice number via RPC
      const { data: invoiceNum, error: rpcError } = await (supabase.rpc as any)(
        'generate_invoice_number',
        { p_clinic_id: clinicId }
      )
      if (rpcError) throw rpcError

      // 2. Insert invoice
      const { data: newInvoice, error: invError } = await supabase
        .from('invoices')
        .insert({
          clinic_id: clinicId,
          patient_id: selectedPatient.id,
          booking_id: selectedBooking?.id ?? null,
          invoice_number: invoiceNum,
          status: 'draft',
          subtotal: subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          currency: clinicCurrency,
          due_date: invoiceForm.due_date || null,
          notes: null,
          patient_insurance_name: invoiceForm.patient_insurance_name?.trim() || null,
          patient_policy_number: invoiceForm.patient_policy_number?.trim() || null,
          override_therapist_name: invoiceForm.override_therapist_name?.trim() || null,
          override_therapist_email: invoiceForm.override_therapist_email?.trim() || null,
        })
        .select()
        .single()
      if (invError) throw invError

      // 3. Insert invoice item
      const { error: itemError } = await supabase
        .from('invoice_items')
        .insert({
          invoice_id: newInvoice.id,
          clinic_id: clinicId,
          description: invoiceForm.description,
          quantity: 1,
          unit_price: subtotal,
          line_total: subtotal,
        })
      if (itemError) throw itemError

      toast.success(`Invoice ${invoiceNum} created`)
      closeInvoiceModal()
      await fetchInvoices(clinicId)
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create invoice')
    } finally {
      setSubmittingInvoice(false)
    }
  }

  const handleSendInvoice = (_id: string) => {
    toast.info('Send invoice — coming soon')
  }

  const closeInvoiceModal = () => {
    setShowInvoiceModal(false)
    setInvoiceType('booking')
    setModalStep(1)
    setSelectedPatient(null)
    setSelectedBooking(null)
    setCompletedBookings([])
    const days = clinicInfo?.payment_terms_days ?? 30
    const dDate = defaultDueDate(days)
    setInvoiceForm({
      description: '',
      amount: '',
      due_date: dDate,
      patient_insurance_name: '',
      patient_policy_number: '',
    })
    setManualForm({
      patient_name: '',
      description: '',
      amount: '',
      due_date: dDate,
      notes: '',
      patient_insurance_name: '',
      patient_policy_number: '',
      override_therapist_name: '',
      override_therapist_email: '',
    })
    setShowInsuranceFields(false)
    setShowTherapistOverrides(false)
  }

  // ─── Data marks ───────────────────────────────────────────────────────────

  const handleMarkPaid = async (id: string) => {
    setMarkingId(id)
    try {
      const { error } = await supabase
        .from('cash_ledger')
        .update({ payment_status: 'paid' })
        .eq('id', id)
      if (error) throw error
      toast.success('Session marked as paid')
      setLedger(prev => prev.map(r => r.id === id ? { ...r, payment_status: 'paid' } : r))
    } catch {
      toast.error('Failed to update payment status')
    } finally {
      setMarkingId(null)
    }
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  const paid = ledger.filter(r => r.payment_status === 'paid')
  const unpaid = ledger.filter(r => r.payment_status === 'unpaid')
  const totalCollected = paid.reduce((a, r) => a + r.amount, 0)

  const nowZoned = getZonedDate(new Date(), 'Europe/London')
  const firstOfMonth = new Date(nowZoned.getFullYear(), nowZoned.getMonth(), 1)
  const thisMonth = paid
    .filter(r => new Date(r.recorded_at) >= firstOfMonth)
    .reduce((a, r) => a + r.amount, 0)

  // ── Chart data ────────────────────────────────────────────────────────────

  const chartData: ChartDatum[] = Object.entries(
    paid.reduce<Record<string, number>>((acc, r) => {
      const type = r.bookings?.appointment_type ?? 'unknown'
      acc[type] = (acc[type] ?? 0) + r.amount
      return acc
    }, {})
  ).map(([type, total]) => ({ type: TYPE_LABELS[type] ?? type, total }))

  // ── Monthly summary ───────────────────────────────────────────────────────

  const months = last6Months()
  const monthlySummary: MonthlySummary[] = months.map(({ label, year, month }) => {
    const rows = ledger.filter(r => {
      const d = new Date(r.recorded_at)
      return d.getFullYear() === year && d.getMonth() === month
    })
    const sessions = rows.length
    const collected = rows.filter(r => r.payment_status === 'paid').reduce((a, r) => a + r.amount, 0)
    const unpaidAmt = rows.filter(r => r.payment_status === 'unpaid').reduce((a, r) => a + r.amount, 0)
    return { month: label, sessions, collected, unpaid: unpaidAmt, net: collected - unpaidAmt }
  })

  // ─── Sub-components ───────────────────────────────────────────────────────

  const StatCard = ({
    label, value, sub, amber = false,
  }: { label: string; value: React.ReactNode; sub?: string; amber?: boolean }) => (
    <div className={`bg-card rounded-xl p-5 shadow-sm flex flex-col gap-1 border ${amber ? 'border-amber-300' : 'border-border'}`}>
      <span className="text-xs font-medium text-text/50 uppercase tracking-wide">{label}</span>
      <span className="text-[28px] font-bold font-bricolage text-primary leading-none mt-1">{value}</span>
      {sub && <span className="text-xs text-text/40 mt-1">{sub}</span>}
    </div>
  )

  const StatusBadge = ({ status }: { status: string }) => {
    const s = STATUS_BADGE[status] ?? STATUS_BADGE.draft
    return (
      <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border ${s.cls}`}>
        {s.label}
      </span>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-[28px] font-bold text-primary font-bricolage mb-8">Revenue</h1>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Projected Revenue"
            value={`${upcomingCount} sessions`}
            sub="upcoming bookings"
          />
          <StatCard
            label="Actual Collected"
            value={fmt(totalCollected)}
            sub="all time"
          />
          <StatCard
            label="Unpaid Sessions"
            value={unpaid.length}
            sub={`${fmt(unpaid.reduce((a, r) => a + r.amount, 0))} outstanding`}
            amber
          />
          <StatCard
            label="This Month"
            value={fmt(thisMonth)}
            sub={formatLocalTime(new Date().toISOString(), 'GB', 'MMMM yyyy', 'Europe/London')}
          />
        </div>

        {/* ── Unpaid Sessions ── */}
        <div className="bg-card border border-border rounded-xl shadow-sm mb-8 overflow-hidden">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-alert" />
            <h2 className="font-bold text-alert font-bricolage">Unpaid Sessions</h2>
            {unpaid.length > 0 && (
              <span className="ml-1 text-xs font-bold bg-alert/10 text-alert border border-alert/20 px-2 py-0.5 rounded-full">
                {unpaid.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-text/60">Loading…</div>
          ) : unpaid.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-text/50">
              <CheckCircle className="w-10 h-10 text-green-400" />
              <p className="font-medium text-text/70">All sessions are paid.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background/50 border-b border-border text-sm font-medium text-text/70">
                    <th className="p-4">Patient</th>
                    <th className="p-4">Session Date</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {unpaid.map(row => (
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-background/30 transition-colors border-l-2 border-l-amber-400">
                      <td className="p-4 font-medium text-text">{row.patients?.full_name ?? '—'}</td>
                      <td className="p-4 text-sm text-text/70">
                        {row.bookings?.appointment_time
                          ? formatLocalTime(row.bookings.appointment_time, 'GB', 'MMM d, yyyy', 'Europe/London')
                          : '—'}
                      </td>
                      <td className="p-4 font-semibold text-text">
                        {fmt(row.amount)}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleMarkPaid(row.id)}
                          disabled={markingId === row.id}
                          className="text-xs bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          {markingId === row.id ? 'Saving…' : 'Mark Paid'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Invoices ── */}
        <div className="bg-card border border-border rounded-xl shadow-sm mb-8 overflow-hidden">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-text font-bricolage flex-1">Invoices</h2>
            {invoices.length > 0 && (
              <span className="text-xs font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full mr-2">
                {invoices.length}
              </span>
            )}
            <button
              id="new-invoice-btn"
              onClick={() => {
                const days = clinicInfo?.payment_terms_days ?? 30
                const dDate = defaultDueDate(days)
                setInvoiceForm(f => ({ ...f, due_date: dDate }))
                setManualForm(f => ({ ...f, due_date: dDate }))
                setShowInvoiceModal(true)
              }}
              className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              New Invoice
            </button>
          </div>

          {invoicesLoading ? (
            <div className="p-10 text-center text-sm text-text/60 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading invoices…
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-text/50">
              <FileText className="w-10 h-10 text-text/20" />
              <p className="font-medium text-text/70">No invoices yet.</p>
              <p className="text-xs text-text/40">Click "+ New Invoice" to create one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background/50 border-b border-border text-sm font-medium text-text/70">
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Patient</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Due Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr
                      key={inv.id}
                      className="border-b border-border last:border-0 hover:bg-background/30 transition-colors"
                    >
                      <td className="p-4 font-mono text-sm font-semibold text-primary">
                        {inv.invoice_number}
                      </td>
                      <td className="p-4 font-medium text-text">
                        {inv.patient_id === null ? (inv.manual_patient_name ?? '—') : (inv.patients?.full_name ?? '—')}
                      </td>
                      <td className="p-4 font-semibold text-text">
                        {fmtCurrency(inv.total_amount, inv.currency)}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="p-4 text-sm text-text/70">
                        {inv.due_date
                          ? formatLocalTime(inv.due_date, 'GB', 'MMM d, yyyy', 'Europe/London')
                          : '—'}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            id={`send-invoice-${inv.id}`}
                            onClick={() => handleSendInvoice(inv.id)}
                            className="flex items-center gap-1 text-xs font-medium text-text/60 hover:text-primary border border-border hover:border-primary/30 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <Send className="w-3 h-3" />
                            Send
                          </button>
                          <button
                            id={`view-invoice-${inv.id}`}
                            onClick={() => openViewInvoice(inv)}
                            className="flex items-center gap-1 text-xs font-medium text-text/60 hover:text-primary border border-border hover:border-primary/30 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Revenue by Treatment Type ── */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-5 mb-8">
          <h2 className="font-bold text-text font-bricolage mb-5">Revenue by Treatment Type</h2>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-text/40 italic">No collected revenue yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0EEF0" vertical={false} />
                <XAxis dataKey="type" tick={{ fontSize: 12, fill: '#32323f', opacity: 0.6 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#32323f', opacity: 0.6 }} axisLine={false} tickLine={false} tickFormatter={v => `£${v}`} />
                <Tooltip
                  formatter={(v: any) => v !== undefined ? [fmt(v as number), ''] : ['', '']}
                  contentStyle={{ borderRadius: 8, borderColor: '#E0EEF0', fontSize: 13 }}
                />
                <Bar dataKey="total" fill="#006D77" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Monthly Summary ── */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-bold text-text font-bricolage">Monthly Summary</h2>
            <p className="text-xs text-text/50 mt-0.5">Last 6 months</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background/50 border-b border-border text-sm font-medium text-text/70">
                  <th className="p-4">Month</th>
                  <th className="p-4 text-right">Sessions</th>
                  <th className="p-4 text-right">Collected</th>
                  <th className="p-4 text-right">Unpaid</th>
                  <th className="p-4 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map(row => (
                  <tr key={row.month} className="border-b border-border last:border-0 hover:bg-background/30 transition-colors">
                    <td className="p-4 font-medium text-text">{row.month}</td>
                    <td className="p-4 text-right text-text/80">{row.sessions}</td>
                    <td className="p-4 text-right text-green-700 font-medium">{fmt(row.collected)}</td>
                    <td className="p-4 text-right text-amber-600 font-medium">{fmt(row.unpaid)}</td>
                    <td className={`p-4 text-right font-semibold ${row.net >= 0 ? 'text-text' : 'text-alert'}`}>
                      {fmt(row.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── New Invoice Modal ── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {showInvoiceModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeInvoiceModal() }}
        >
          <div className="relative bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">

            {/* Modal header */}
            <div className="flex items-center gap-3 p-5 border-b border-border shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Receipt className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-text font-bricolage">New Invoice</h3>
                <p className="text-xs text-text/50 mt-0.5">
                  {invoiceType === 'booking' ? (
                    <>
                      {modalStep === 1 && 'Step 1 of 3 — Search patient'}
                      {modalStep === 2 && 'Step 2 of 3 — Select session'}
                      {modalStep === 3 && 'Step 3 of 3 — Review & submit'}
                    </>
                  ) : (
                    'Manual invoice'
                  )}
                </p>
              </div>
              <button onClick={closeInvoiceModal} className="text-text/40 hover:text-text transition-colors p-1 rounded-lg hover:bg-background/50">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-5 shrink-0 bg-background/30 mt-2">
              <button
                onClick={() => setInvoiceType('booking')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 text-center transition-colors ${
                  invoiceType === 'booking'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-text/50 hover:text-text'
                }`}
              >
                From booking
              </button>
              <button
                onClick={() => setInvoiceType('manual')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 text-center transition-colors ${
                  invoiceType === 'manual'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-text/50 hover:text-text'
                }`}
              >
                Manual
              </button>
            </div>

            {/* Step indicator */}
            {invoiceType === 'booking' && (
              <div className="flex px-5 pt-4 gap-2 shrink-0">
                {[1, 2, 3].map(s => (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      s <= modalStep ? 'bg-primary' : 'bg-border'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 p-5">

              {/* ── Booking Flow ── */}
              {invoiceType === 'booking' && (
                <>
                  {/* ── Step 1: Patient search ── */}
                  {modalStep === 1 && (
                    <div className="flex flex-col gap-4 pb-32">
                      <p className="text-sm text-text/70">Select a patient to begin.</p>
                      <PatientSelector
                        clinicId={clinicId}
                        selectedPatientId={selectedPatient?.id ?? null}
                        onSelect={handleSelectPatient}
                      />
                    </div>
                  )}

                  {/* ── Step 2: Select completed booking ── */}
                  {modalStep === 2 && selectedPatient && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {(selectedPatient.full_name ?? '?')[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text">{selectedPatient.full_name}</p>
                          {selectedPatient.phone_number && (
                            <p className="text-xs text-text/50">{selectedPatient.phone_number}</p>
                          )}
                        </div>
                        <button
                          onClick={() => { setSelectedPatient(null); setModalStep(1) }}
                          className="ml-auto text-xs text-text/40 hover:text-text border border-border px-2 py-0.5 rounded-lg transition-colors"
                        >
                          Change
                        </button>
                      </div>

                      <p className="text-sm text-text/70">Select a completed session to attach to this invoice.</p>

                      {bookingsLoading ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-sm text-text/50">
                          <Loader2 className="w-4 h-4 animate-spin" /> Loading sessions…
                        </div>
                      ) : completedBookings.length === 0 ? (
                        <div className="text-center py-8 text-sm text-text/40">
                          No completed sessions found for this patient.
                        </div>
                      ) : (
                        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                          {completedBookings.map(b => (
                            <button
                              key={b.id}
                              id={`booking-result-${b.id}`}
                              onClick={() => handleSelectBooking(b)}
                              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-background/60 transition-colors text-left group"
                            >
                              <div>
                                <p className="text-sm font-medium text-text">
                                  {APPT_TYPE_LABELS[b.appointment_type ?? ''] ?? b.appointment_type ?? 'Session'}
                                </p>
                                <p className="text-xs text-text/50 mt-0.5">
                                  {b.appointment_time
                                    ? formatLocalTime(b.appointment_time, 'GB', 'MMM d, yyyy', 'Europe/London')
                                    : 'Date unknown'}
                                  {b.appointment_price != null && ` · ${fmtCurrency(b.appointment_price, clinicCurrency)}`}
                                </p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-text/30 group-hover:text-primary transition-colors" />
                            </button>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setSelectedBooking(null)
                          setInvoiceForm({ description: '', amount: '', due_date: defaultDueDate() })
                          setModalStep(3)
                        }}
                        className="text-xs text-text/50 hover:text-primary text-center underline underline-offset-2 transition-colors"
                      >
                        Skip — create invoice without attaching a session
                      </button>
                    </div>
                  )}

                  {/* ── Step 3: Review & submit ── */}
                  {modalStep === 3 && (
                    <div className="flex flex-col gap-4">
                      {/* Patient + booking summary */}
                      <div className="bg-background/60 rounded-xl border border-border p-4 flex flex-col gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-text/50">Patient</span>
                          <span className="font-medium text-text">{selectedPatient?.full_name ?? '—'}</span>
                        </div>
                        {selectedBooking && (
                          <div className="flex justify-between">
                            <span className="text-text/50">Session</span>
                            <span className="text-text/80">
                              {APPT_TYPE_LABELS[selectedBooking.appointment_type ?? ''] ?? selectedBooking.appointment_type}
                              {selectedBooking.appointment_time && (
                                <span className="text-text/50 ml-1">
                                  · {formatLocalTime(selectedBooking.appointment_time, 'GB', 'MMM d, yyyy', 'Europe/London')}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                          Description
                        </label>
                        <input
                          id="invoice-description"
                          type="text"
                          value={invoiceForm.description}
                          onChange={e => setInvoiceForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="e.g. Follow-up Session — May 30, 2025"
                          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text/30"
                        />
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                          Amount ({clinicCurrency})
                        </label>
                        <input
                          id="invoice-amount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={invoiceForm.amount}
                          onChange={e => setInvoiceForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder="0.00"
                          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text/30"
                        />
                      </div>

                      {/* Due date */}
                      <div>
                        <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                          Due Date
                        </label>
                        <input
                          id="invoice-due-date"
                          type="date"
                          value={invoiceForm.due_date}
                          onChange={e => setInvoiceForm(f => ({ ...f, due_date: e.target.value }))}
                          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </div>

                      {/* Collapsible Insurance Section */}
                      <div className="border border-border rounded-xl overflow-hidden bg-background/30">
                        <button
                          type="button"
                          onClick={() => setShowInsuranceFields(!showInsuranceFields)}
                          className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-text/60 uppercase tracking-wide hover:bg-background/50 transition-colors"
                        >
                          <span>Private insurance (optional)</span>
                          <span className="text-text/40">{showInsuranceFields ? 'Hide' : 'Show'}</span>
                        </button>
                        {showInsuranceFields && (
                          <div className="p-4 border-t border-border flex flex-col gap-4 bg-background/20">
                            <div>
                              <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                                Insurance provider name
                              </label>
                              <input
                                type="text"
                                value={invoiceForm.patient_insurance_name || ''}
                                onChange={e => setInvoiceForm(f => ({ ...f, patient_insurance_name: e.target.value }))}
                                placeholder="e.g. Bupa, AXA, Vitality"
                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text/30"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                                Policy number
                              </label>
                              <input
                                type="text"
                                value={invoiceForm.patient_policy_number || ''}
                                onChange={e => setInvoiceForm(f => ({ ...f, patient_policy_number: e.target.value }))}
                                placeholder="Policy number"
                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text/30"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Collapsible Overrides Section */}
                      <div className="border border-border rounded-xl overflow-hidden bg-background/30">
                        <button
                          type="button"
                          onClick={() => setShowTherapistOverrides(!showTherapistOverrides)}
                          className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-text/60 uppercase tracking-wide hover:bg-background/50 transition-colors"
                        >
                          <span>Invoice Details (optional overrides)</span>
                          <span className="text-text/40">{showTherapistOverrides ? 'Hide' : 'Show'}</span>
                        </button>
                        {showTherapistOverrides && (
                          <div className="p-4 border-t border-border flex flex-col gap-4 bg-background/20">
                            <div>
                              <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                                Therapist name
                              </label>
                              <input
                                type="text"
                                value={invoiceForm.override_therapist_name || ''}
                                onChange={e => setInvoiceForm(f => ({ ...f, override_therapist_name: e.target.value }))}
                                placeholder="e.g. Dr. Sarah Smith"
                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text/30"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                                Therapist email
                              </label>
                              <input
                                type="email"
                                value={invoiceForm.override_therapist_email || ''}
                                onChange={e => setInvoiceForm(f => ({ ...f, override_therapist_email: e.target.value }))}
                                placeholder="sarah@clinic.com"
                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text/30"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Total preview */}
                      {invoiceForm.amount && !isNaN(parseFloat(invoiceForm.amount)) && (() => {
                        const amt = parseFloat(invoiceForm.amount)
                        const isVat = clinicInfo?.is_vat_registered ?? false
                        const vatRate = clinicInfo?.vat_rate ?? 20
                        const tax = isVat ? amt * (vatRate / 100) : 0
                        const tot = isVat ? amt + tax : amt
                        return (
                          <div className="flex flex-col gap-1.5 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-text/50">Subtotal</span>
                              <span className="text-sm font-medium text-text/70">{fmtCurrency(amt, clinicCurrency)}</span>
                            </div>
                            {isVat && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-text/50">VAT ({vatRate}%)</span>
                                <span className="text-sm font-medium text-text/70">{fmtCurrency(tax, clinicCurrency)}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between pt-1.5 border-t border-primary/20 mt-0.5">
                              <span className="text-sm font-semibold text-text/70">Total</span>
                              <span className="text-lg font-bold text-primary font-bricolage">
                                {fmtCurrency(tot, clinicCurrency)}
                              </span>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </>
              )}

              {/* ── Manual Flow ── */}
              {invoiceType === 'manual' && (
                <div className="flex flex-col gap-4">
                  {/* Patient Name */}
                  <div>
                    <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                      Patient Name <span className="text-alert">*</span>
                    </label>
                    <input
                      id="manual-patient-name"
                      type="text"
                      required
                      value={manualForm.patient_name}
                      onChange={e => setManualForm(f => ({ ...f, patient_name: e.target.value }))}
                      placeholder="e.g. John Doe"
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text/30"
                    />
                  </div>

                  {/* Service Description */}
                  <div>
                    <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                      Service Description <span className="text-alert">*</span>
                    </label>
                    <input
                      id="manual-description"
                      type="text"
                      required
                      value={manualForm.description}
                      onChange={e => setManualForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="e.g. Physiotherapy Session"
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text/30"
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                      Amount ({clinicCurrency}) <span className="text-alert">*</span>
                    </label>
                    <input
                      id="manual-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={manualForm.amount}
                      onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text/30"
                    />
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                      Due Date <span className="text-alert">*</span>
                    </label>
                    <input
                      id="manual-due-date"
                      type="date"
                      required
                      value={manualForm.due_date}
                      onChange={e => setManualForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                      Notes (Optional)
                    </label>
                    <textarea
                      id="manual-notes"
                      rows={3}
                      value={manualForm.notes}
                      onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Add any additional notes for the patient…"
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text/30 resize-none"
                    />
                  </div>

                  {/* Collapsible Insurance Section */}
                  <div className="border border-border rounded-xl overflow-hidden bg-background/30">
                    <button
                      type="button"
                      onClick={() => setShowInsuranceFields(!showInsuranceFields)}
                      className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-text/60 uppercase tracking-wide hover:bg-background/50 transition-colors"
                    >
                      <span>Private insurance (optional)</span>
                      <span className="text-text/40">{showInsuranceFields ? 'Hide' : 'Show'}</span>
                    </button>
                    {showInsuranceFields && (
                      <div className="p-4 border-t border-border flex flex-col gap-4 bg-background/20">
                        <div>
                          <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                            Insurance provider name
                          </label>
                          <input
                            type="text"
                            value={manualForm.patient_insurance_name || ''}
                            onChange={e => setManualForm(f => ({ ...f, patient_insurance_name: e.target.value }))}
                            placeholder="e.g. Bupa, AXA, Vitality"
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text/30"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                            Policy number
                          </label>
                          <input
                            type="text"
                            value={manualForm.patient_policy_number || ''}
                            onChange={e => setManualForm(f => ({ ...f, patient_policy_number: e.target.value }))}
                            placeholder="Policy number"
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text/30"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Collapsible Overrides Section */}
                  <div className="border border-border rounded-xl overflow-hidden bg-background/30">
                    <button
                      type="button"
                      onClick={() => setShowTherapistOverrides(!showTherapistOverrides)}
                      className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-text/60 uppercase tracking-wide hover:bg-background/50 transition-colors"
                    >
                      <span>Invoice Details (optional overrides)</span>
                      <span className="text-text/40">{showTherapistOverrides ? 'Hide' : 'Show'}</span>
                    </button>
                    {showTherapistOverrides && (
                      <div className="p-4 border-t border-border flex flex-col gap-4 bg-background/20">
                        <div>
                          <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                            Therapist name
                          </label>
                          <input
                            type="text"
                            value={manualForm.override_therapist_name || ''}
                            onChange={e => setManualForm(f => ({ ...f, override_therapist_name: e.target.value }))}
                            placeholder="e.g. Dr. Sarah Smith"
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text/30"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-text/60 uppercase tracking-wide mb-1.5">
                            Therapist email
                          </label>
                          <input
                            type="email"
                            value={manualForm.override_therapist_email || ''}
                            onChange={e => setManualForm(f => ({ ...f, override_therapist_email: e.target.value }))}
                            placeholder="sarah@clinic.com"
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text/30"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Total preview */}
                  {manualForm.amount && !isNaN(parseFloat(manualForm.amount)) && (() => {
                    const amt = parseFloat(manualForm.amount)
                    const isVat = clinicInfo?.is_vat_registered ?? false
                    const vatRate = clinicInfo?.vat_rate ?? 20
                    const tax = isVat ? amt * (vatRate / 100) : 0
                    const tot = isVat ? amt + tax : amt
                    return (
                      <div className="flex flex-col gap-1.5 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-text/50">Subtotal</span>
                          <span className="text-sm font-medium text-text/70">{fmtCurrency(amt, clinicCurrency)}</span>
                        </div>
                        {isVat && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-text/50">VAT ({vatRate}%)</span>
                            <span className="text-sm font-medium text-text/70">{fmtCurrency(tax, clinicCurrency)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1.5 border-t border-primary/20 mt-0.5">
                          <span className="text-sm font-semibold text-text/70">Total</span>
                          <span className="text-lg font-bold text-primary font-bricolage">
                            {fmtCurrency(tot, clinicCurrency)}
                          </span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="p-5 border-t border-border shrink-0 flex gap-3">
              {invoiceType === 'booking' ? (
                modalStep > 1 ? (
                  <button
                    onClick={() => setModalStep(s => (s === 3 ? 2 : 1) as 1 | 2 | 3)}
                    className="flex-1 border border-border text-text/70 hover:text-text hover:border-text/30 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    Back
                  </button>
                ) : (
                  <button
                    onClick={closeInvoiceModal}
                    className="flex-1 border border-border text-text/70 hover:text-text py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                )
              ) : (
                <button
                  onClick={closeInvoiceModal}
                  className="flex-1 border border-border text-text/70 hover:text-text py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              )}

              {((invoiceType === 'booking' && modalStep === 3) || invoiceType === 'manual') && (
                <button
                  id="submit-invoice-btn"
                  onClick={handleSubmitInvoice}
                  disabled={submittingInvoice}
                  className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submittingInvoice ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                  ) : (
                    <><Receipt className="w-4 h-4" /> Create Invoice</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── View Invoice Modal ── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {viewingInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setViewingInvoice(null) }}
        >
          <div className="relative bg-card w-full max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border flex flex-col max-h-[92vh]">

            {/* Modal toolbar */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0 print:hidden">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <span className="font-mono font-bold text-text">{viewingInvoice.invoice_number}</span>
                <span className="ml-2"><StatusBadge status={viewingInvoice.status} /></span>
              </div>
              <button
                id="print-invoice-btn"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs font-medium text-text/60 hover:text-primary border border-border hover:border-primary/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
              <button
                onClick={() => setViewingInvoice(null)}
                className="text-text/40 hover:text-text transition-colors p-1 rounded-lg hover:bg-background/50 ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoice preview body */}
            <div id="invoice-print-area" className="overflow-y-auto flex-1">
              {viewLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-text/50">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading invoice…
                </div>
              ) : (
                <div className="p-6 sm:p-8 flex flex-col gap-6">

                  {/* ── Header: Clinic + Invoice meta ── */}
                  <div className="flex items-start justify-between gap-4">
                    {/* Clinic branding */}
                    <div className="flex items-start gap-3">
                      {viewingClinic?.logo_url ? (
                        <img
                          src={viewingClinic.logo_url}
                          alt={viewingClinic.name}
                          className="w-14 h-14 rounded-xl object-cover border border-border shadow-sm shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-7 h-7 text-primary/60" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-text font-bricolage text-lg leading-tight">
                          {viewingClinic?.name ?? '—'}
                        </p>
                        {viewingClinic?.contact_address && (
                          <p className="text-xs text-text/50 mt-0.5 max-w-[220px]">{viewingClinic.contact_address}</p>
                        )}
                        {viewingClinic?.contact_phone && (
                          <p className="text-xs text-text/50">{viewingClinic.contact_phone}</p>
                        )}
                        {viewingClinic?.contact_email && (
                          <p className="text-xs text-text/50">{viewingClinic.contact_email}</p>
                        )}
                      </div>
                    </div>
                    {/* Powered by */}
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-text/30 font-medium uppercase tracking-widest">Powered by KinetiMap</p>
                    </div>
                  </div>

                  {/* ── Two-column: Patient info | Invoice details ── */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Patient */}
                    <div className="bg-background/60 rounded-xl border border-border p-4">
                      <p className="text-xs font-semibold text-text/40 uppercase tracking-wide mb-2">Bill To</p>
                      <p className="font-semibold text-text">
                        {viewingInvoice.patient_id === null
                          ? (viewingInvoice.manual_patient_name ?? '—')
                          : (viewingInvoice.patients?.full_name ?? '—')}
                      </p>
                      {viewingInvoice.patients?.phone_number && (
                        <p className="text-sm text-text/50 mt-0.5">{viewingInvoice.patients.phone_number}</p>
                      )}
                    </div>
                    {/* Invoice meta */}
                    <div className="bg-background/60 rounded-xl border border-border p-4 flex flex-col gap-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text/50">Invoice #</span>
                        <span className="font-mono font-semibold text-primary">{viewingInvoice.invoice_number}</span>
                      </div>
                      {(viewingInvoice.override_therapist_name || viewingInvoice.bookings?.clinic_users?.name) && (
                        <div className="flex justify-between">
                          <span className="text-text/50">Treated by</span>
                          <span className="text-text">{viewingInvoice.override_therapist_name || viewingInvoice.bookings?.clinic_users?.name}</span>
                        </div>
                      )}
                      {viewingInvoice.bookings?.appointment_time && (
                        <div className="flex justify-between">
                          <span className="text-text/50">Session Date</span>
                          <span className="text-text">{formatLocalTime(viewingInvoice.bookings.appointment_time, 'GB', 'MMM d, yyyy', 'Europe/London')}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-text/50">Issued</span>
                        <span className="text-text">{formatLocalTime(viewingInvoice.created_at, 'GB', 'MMM d, yyyy', 'Europe/London')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text/50">Due Date</span>
                        <span className={`font-medium ${
                          viewingInvoice.due_date && new Date(viewingInvoice.due_date) < new Date()
                            ? 'text-alert' : 'text-text'
                         }`}>
                          {viewingInvoice.due_date
                            ? formatLocalTime(viewingInvoice.due_date, 'GB', 'MMM d, yyyy', 'Europe/London')
                            : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-0.5">
                        <span className="text-text/50">Status</span>
                        <StatusBadge status={viewingInvoice.status} />
                      </div>
                    </div>
                  </div>

                  {/* Insurance Section */}
                  {viewingInvoice.patient_insurance_name && (
                    <div className="bg-background/60 rounded-xl border border-border p-4 text-sm">
                      <span className="text-xs font-semibold text-text/40 uppercase tracking-wide block mb-1">Insurance details</span>
                      <p className="text-text font-medium">
                        Submitted to <span className="font-semibold">{viewingInvoice.patient_insurance_name}</span> — Policy: <span className="font-mono">{viewingInvoice.patient_policy_number ?? '—'}</span>
                      </p>
                    </div>
                  )}

                  {/* ── Line items table ── */}
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead>
                        <tr className="bg-primary/5 border-b border-border text-xs font-semibold text-text/60 uppercase tracking-wide">
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3 text-center">Qty</th>
                          <th className="px-4 py-3 text-right">Unit Price</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {viewingItems.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-text/40 italic text-sm">
                              No line items
                            </td>
                          </tr>
                        ) : (
                          viewingItems.map(item => (
                            <tr key={item.id} className="hover:bg-background/40 transition-colors">
                              <td className="px-4 py-3 text-text font-medium">{item.description}</td>
                              <td className="px-4 py-3 text-center text-text/70">{item.quantity}</td>
                              <td className="px-4 py-3 text-right text-text/70">{fmtCurrency(item.unit_price, viewingInvoice.currency)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-text">{fmtCurrency(item.line_total, viewingInvoice.currency)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* ── Totals ── */}
                  <div className="flex justify-end">
                    <div className="w-64 flex flex-col gap-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text/50">Subtotal</span>
                        <span className="text-text">{fmtCurrency(viewingInvoice.subtotal, viewingInvoice.currency)}</span>
                      </div>
                      {viewingClinic?.is_vat_registered ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-text/50">VAT ({viewingClinic.vat_rate}%):</span>
                            <span className="text-text">{fmtCurrency(viewingInvoice.tax_amount, viewingInvoice.currency)}</span>
                          </div>
                          {viewingClinic.vat_number && (
                            <div className="text-[10px] text-text/40 text-right">
                              VAT Reg No: {viewingClinic.vat_number}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-text/50">VAT:</span>
                          <span className="text-text text-text/40 italic">Not applicable</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-border mt-1">
                        <span className="font-bold text-text">Total</span>
                        <span className="text-xl font-bold text-primary font-bricolage">
                          {fmtCurrency(viewingInvoice.total_amount, viewingInvoice.currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Notes ── */}
                  {viewingInvoice.notes && (
                    <div className="bg-background/60 rounded-xl border border-border p-4">
                      <p className="text-xs font-semibold text-text/40 uppercase tracking-wide mb-1.5">Notes</p>
                      <p className="text-sm text-text/80 leading-relaxed">{viewingInvoice.notes}</p>
                    </div>
                  )}

                  {/* ── Payment link ── */}
                  {viewingInvoice.payment_link_token && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3 print:hidden">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-primary/80 uppercase tracking-wide mb-0.5">Payment Link</p>
                        <p className="text-sm text-text/70 font-mono break-all">
                          {window.location.origin}/pay/{viewingInvoice.payment_link_token}
                        </p>
                      </div>
                      <a
                        href={`/pay/${viewingInvoice.payment_link_token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open
                      </a>
                    </div>
                  )}

                  {/* Legal footer */}
                  <div className="mt-6 border-t border-border pt-4 text-[10px] text-text/40 flex flex-col gap-1 leading-relaxed">
                    <p>Payment due within {viewingClinic?.payment_terms_days ?? 30} days.</p>
                    <p>Late payments may incur interest at 8% per annum in accordance with the Late Payment of Commercial Debts Act 1998.</p>
                    <p>All services provided under the clinic's professional indemnity insurance cover.</p>
                    {viewingClinic?.is_vat_registered && viewingClinic?.vat_number && (
                      <p>This is a valid VAT invoice under UK law. VAT Registration No: {viewingClinic.vat_number}</p>
                    )}
                  </div>

                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border shrink-0 flex gap-3 print:hidden">
              <button
                id="send-invoice-modal-btn"
                onClick={() => handleSendInvoice(viewingInvoice.id)}
                className="flex items-center justify-center gap-2 border border-border text-text/70 hover:text-primary hover:border-primary/30 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                <Send className="w-4 h-4" />
                Send Invoice
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setViewingInvoice(null)}
                className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  )
}
