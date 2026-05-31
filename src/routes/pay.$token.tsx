import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, AlertCircle, CheckCircle, Building2, Printer, CreditCard } from 'lucide-react'
import { Helmet } from 'react-helmet-async'

export const Route = createFileRoute('/pay/$token')({
  component: PaymentPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceItem = {
  id: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
}

type InvoiceData = {
  id: string
  invoice_number: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  subtotal: number
  tax_amount: number
  total_amount: number
  currency: string
  due_date: string | null
  notes: string | null
  created_at: string
  manual_patient_name: string | null
  patient_insurance_name: string | null
  patient_policy_number: string | null
  patients: { full_name: string | null; phone_number: string | null } | null
  clinics: {
    name: string
    logo_url: string | null
    contact_email: string | null
    contact_phone: string | null
    contact_address: string | null
    brand_color: string | null
    currency: string
    is_vat_registered: boolean
    vat_number: string | null
    vat_rate: number
    payment_terms_days: number
  } | null
  invoice_items: InvoiceItem[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(n: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(n)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  draft:     { label: 'Draft',     bg: 'bg-gray-100',   text: 'text-gray-600',  border: 'border-gray-200' },
  sent:      { label: 'Sent',      bg: 'bg-blue-50',    text: 'text-blue-700',  border: 'border-blue-200' },
  paid:      { label: 'Paid',      bg: 'bg-green-50',   text: 'text-green-700', border: 'border-green-200' },
  overdue:   { label: 'Overdue',   bg: 'bg-red-50',     text: 'text-red-700',   border: 'border-red-200' },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-50',    text: 'text-gray-400',  border: 'border-gray-100' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PaymentPage() {
  const { token } = Route.useParams()
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [payLoading, setPayLoading] = useState(false)

  useEffect(() => {
    fetchInvoice()
  }, [token])

  const fetchInvoice = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          patients(full_name, phone_number),
          clinics(name, logo_url, contact_email, contact_phone, contact_address, brand_color, currency, is_vat_registered, vat_number, vat_rate, payment_terms_days),
          invoice_items(id, description, quantity, unit_price, line_total)
        `)
        .eq('payment_link_token', token)
        .maybeSingle()

      if (error) throw error
      if (!data) {
        setError('Invoice not found. This link may be invalid or expired.')
        return
      }
      setInvoice(data as unknown as InvoiceData)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load invoice.')
    } finally {
      setLoading(false)
    }
  }

  const handlePayNow = async () => {
    setPayLoading(true)
    // Payment gateway integration stub
    await new Promise(r => setTimeout(r, 1000))
    alert('Payment gateway coming soon. Please contact your clinic directly to complete payment.')
    setPayLoading(false)
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EDF6F9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-[#006D77]" />
          <p className="text-sm font-medium">Loading invoice…</p>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-[#EDF6F9] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg border border-gray-100">
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invoice Not Found</h1>
          <p className="text-gray-500 text-sm leading-relaxed">{error ?? 'This payment link is invalid or has expired.'}</p>
        </div>
      </div>
    )
  }

  const clinic = invoice.clinics
  const patient = invoice.patients
  const items = invoice.invoice_items ?? []
  const brandColor = clinic?.brand_color ?? '#006D77'
  const isPaid = invoice.status === 'paid'
  const patientName = invoice.manual_patient_name ?? patient?.full_name ?? '—'
  const statusStyle = STATUS_STYLES[invoice.status] ?? STATUS_STYLES.draft
  const isOverdue = invoice.status === 'overdue' || (invoice.due_date && new Date(invoice.due_date) < new Date() && !isPaid)

  return (
    <>
      <Helmet>
        <title>Invoice {invoice.invoice_number} — {clinic?.name ?? 'KinetiMap'}</title>
        <meta name="description" content={`Pay invoice ${invoice.invoice_number} from ${clinic?.name}.`} />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="min-h-screen bg-[#EDF6F9] py-10 px-4 sm:px-6 font-sans print:bg-white print:py-0 print:px-0">
        <div className="max-w-2xl mx-auto print:max-w-none">

          {/* ── Invoice card ── */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden print:shadow-none print:border-none">

            {/* Brand stripe */}
            <div className="h-1.5 w-full" style={{ background: brandColor }} />

            <div className="p-6 sm:p-8 flex flex-col gap-6">

              {/* ── Header: Clinic branding + Powered by ── */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {clinic?.logo_url ? (
                    <img
                      src={clinic.logo_url}
                      alt={clinic.name}
                      className="w-14 h-14 rounded-xl object-cover border border-gray-100 shadow-sm shrink-0"
                    />
                  ) : (
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: brandColor + '18' }}
                    >
                      <Building2 className="w-7 h-7" style={{ color: brandColor }} />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-gray-900 text-lg leading-tight">{clinic?.name ?? '—'}</p>
                    {clinic?.contact_address && (
                      <p className="text-xs text-gray-400 mt-0.5 max-w-[220px]">{clinic.contact_address}</p>
                    )}
                    {clinic?.contact_phone && <p className="text-xs text-gray-400">{clinic.contact_phone}</p>}
                    {clinic?.contact_email && <p className="text-xs text-gray-400">{clinic.contact_email}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-gray-300 font-medium uppercase tracking-widest">
                    Powered by KinetiMap
                  </p>
                </div>
              </div>

              {/* ── Two-column: Patient info + Invoice meta ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Bill To */}
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Bill To</p>
                  <p className="font-semibold text-gray-900">{patientName}</p>
                  {patient?.phone_number && (
                    <p className="text-sm text-gray-400 mt-0.5">{patient.phone_number}</p>
                  )}
                </div>

                {/* Invoice details */}
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Invoice #</span>
                    <span className="font-mono font-semibold" style={{ color: brandColor }}>{invoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Issued</span>
                    <span className="text-gray-700">{formatDate(invoice.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Due</span>
                    <span className={`font-medium ${
                      invoice.due_date && new Date(invoice.due_date) < new Date() && !isPaid
                        ? 'text-red-600' : 'text-gray-700'
                    }`}>
                      {formatDate(invoice.due_date)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-gray-400">Status</span>
                    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                      {statusStyle.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Insurance details */}
              {invoice.patient_insurance_name && (
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-sm">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Insurance details</span>
                  <p className="text-gray-700 font-medium">
                    Submitted to <span className="font-semibold text-gray-900">{invoice.patient_insurance_name}</span> — Policy: <span className="font-mono text-gray-900">{invoice.patient_policy_number ?? '—'}</span>
                  </p>
                </div>
              )}

              {/* ── Line items table ── */}
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr
                      className="text-xs font-semibold uppercase tracking-wide border-b border-gray-100"
                      style={{ background: brandColor + '12', color: brandColor }}
                    >
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 text-center">Qty</th>
                      <th className="px-4 py-3 text-right">Unit Price</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-gray-400 italic text-sm">
                          No line items
                        </td>
                      </tr>
                    ) : (
                      items.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-gray-800 font-medium">{item.description}</td>
                          <td className="px-4 py-3 text-center text-gray-500">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{fmtCurrency(item.unit_price, invoice.currency)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtCurrency(item.line_total, invoice.currency)}</td>
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
                    <span className="text-gray-400">Subtotal</span>
                    <span className="text-gray-700">{fmtCurrency(invoice.subtotal, invoice.currency)}</span>
                  </div>
                  {clinic?.is_vat_registered ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">VAT ({clinic.vat_rate}%):</span>
                        <span className="text-gray-700">{fmtCurrency(invoice.tax_amount, invoice.currency)}</span>
                      </div>
                      {clinic.vat_number && (
                        <div className="text-[10px] text-gray-400 text-right">
                          VAT Reg No: {clinic.vat_number}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-gray-400">VAT:</span>
                      <span className="text-gray-400 italic">Not applicable</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-1">
                    <span className="font-bold text-gray-900">Total Due</span>
                    <span className="text-2xl font-bold" style={{ color: brandColor }}>
                      {fmtCurrency(invoice.total_amount, invoice.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Notes ── */}
              {invoice.notes && (
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Notes</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{invoice.notes}</p>
                </div>
              )}

              {/* Legal footer */}
              <div className="mt-6 border-t border-gray-100 pt-4 text-[10px] text-gray-400 flex flex-col gap-1 leading-relaxed">
                <p>Payment due within {clinic?.payment_terms_days ?? 30} days of invoice date.</p>
                <p>Late payments may incur interest at 8% per annum.</p>
                <p>All services are provided under professional indemnity cover.</p>
                {clinic?.is_vat_registered && clinic?.vat_number && (
                  <p>VAT Registration No: {clinic.vat_number} — Valid UK tax invoice</p>
                )}
              </div>

              {/* ── CTA ── */}
              {isPaid ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
                    <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                    <div>
                      <p className="font-semibold text-green-800">Payment received ✓</p>
                      <p className="text-sm text-green-600 mt-0.5">Thank you — this invoice has been fully paid.</p>
                    </div>
                  </div>
                  <div className="flex print:hidden">
                    <button
                      id="print-invoice-public-btn"
                      onClick={() => window.print()}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors text-sm font-medium"
                    >
                      <Printer className="w-4 h-4" />
                      Print Invoice
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 print:hidden">
                  {isOverdue && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-800 text-sm font-medium">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>This invoice is overdue</span>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      id="pay-now-btn"
                      onClick={handlePayNow}
                      disabled={payLoading}
                      className="flex-1 flex items-center justify-center gap-2 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 shadow-md hover:shadow-lg"
                      style={{ background: brandColor }}
                    >
                      {payLoading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</>
                      ) : (
                        <><CreditCard className="w-5 h-5" /> Pay {fmtCurrency(invoice.total_amount, invoice.currency)}</>
                      )}
                    </button>
                    <button
                      id="print-invoice-public-btn"
                      onClick={() => window.print()}
                      className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors text-sm font-medium"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ── Footer ── */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-400 print:hidden">
            <img src="/logo.svg" alt="KinetiMap" className="h-5 w-auto opacity-60" />
            <span>Secure invoice by <strong className="text-gray-500">KinetiMap</strong></span>
          </div>

        </div>
      </div>
    </>
  )
}
