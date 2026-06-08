import { useState } from 'react'
import { LegalLayout } from './LegalLayout'
import { supabase } from '../../lib/supabase'
import { CheckCircle, Loader2 } from 'lucide-react'

type RequestType = 'access' | 'delete' | 'correct' | 'export'

const REQUEST_TYPE_OPTIONS: { value: RequestType; label: string }[] = [
  { value: 'access', label: 'Access my data' },
  { value: 'delete', label: 'Delete my data' },
  { value: 'correct', label: 'Correct my data' },
  { value: 'export', label: 'Export my data' },
]

export function GdprRequestPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [requestType, setRequestType] = useState<RequestType | ''>('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requestType) return

    setSubmitting(true)
    setError(null)

    const { error: dbError } = await supabase
      .from('gdpr_requests')
      .insert({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        request_type: requestType,
        details: details.trim() || null,
        status: 'pending',
      })

    setSubmitting(false)

    if (dbError) {
      setError('Something went wrong submitting your request. Please email support@kinetimap.app directly.')
      return
    }

    setSubmitted(true)
  }

  return (
    <LegalLayout
      title="GDPR Data Request"
      description="Submit a GDPR data request to KinetiMap — access, correct, export or delete your personal data under UK GDPR."
      lastUpdated="June 2026"
    >
      <p>
        Under the UK General Data Protection Regulation (UK GDPR), you have the right to access, correct, export, or delete your personal data held by KinetiMap. Use the form below to submit a data request. We will respond within <strong>30 days</strong> as required by law.
      </p>

      <div className="legal-callout">
        This form is for individuals requesting access to their own personal data. If you are a clinic owner requesting patient data exports, please use the in-app export tool or contact <a href="mailto:support@kinetimap.app">support@kinetimap.app</a>.
      </div>

      {submitted ? (
        /* ── Success state ── */
        <div className="mt-8 flex flex-col items-center text-center gap-4 py-12 px-6 bg-[#EDF6F9] border border-[#E0EEF0] rounded-2xl">
          <div className="w-14 h-14 rounded-full bg-[#006D77]/10 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-[#006D77]" />
          </div>
          <h2 style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }} className="font-bricolage font-bold text-xl text-[#32323F]">
            Request Received
          </h2>
          <p className="text-[#32323F]/70 text-sm max-w-md leading-relaxed">
            Your request has been received. We will respond within <strong>30 days</strong> as required by UK GDPR. A confirmation will be sent to <strong>{email}</strong>.
          </p>
          <p className="text-xs text-[#32323F]/40 font-medium">
            If you don't hear from us, email <a href="mailto:support@kinetimap.app" className="text-[#006D77] font-semibold underline underline-offset-2">support@kinetimap.app</a>.
          </p>
        </div>
      ) : (
        /* ── Form ── */
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {/* Full Name */}
          <div>
            <label htmlFor="gdpr-full-name" className="block text-sm font-bold text-[#32323F] mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="gdpr-full-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full border border-[#E0EEF0] rounded-xl px-4 py-3 text-sm text-[#32323F] bg-white focus:outline-none focus:ring-2 focus:ring-[#006D77]/30 focus:border-[#006D77] transition-all placeholder:text-[#32323F]/30"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="gdpr-email" className="block text-sm font-bold text-[#32323F] mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="gdpr-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. jane@example.com"
              className="w-full border border-[#E0EEF0] rounded-xl px-4 py-3 text-sm text-[#32323F] bg-white focus:outline-none focus:ring-2 focus:ring-[#006D77]/30 focus:border-[#006D77] transition-all placeholder:text-[#32323F]/30"
            />
          </div>

          {/* Request Type */}
          <div>
            <label htmlFor="gdpr-request-type" className="block text-sm font-bold text-[#32323F] mb-1.5">
              Request Type <span className="text-red-500">*</span>
            </label>
            <select
              id="gdpr-request-type"
              required
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as RequestType)}
              className="w-full border border-[#E0EEF0] rounded-xl px-4 py-3 text-sm text-[#32323F] bg-white focus:outline-none focus:ring-2 focus:ring-[#006D77]/30 focus:border-[#006D77] transition-all appearance-none cursor-pointer"
            >
              <option value="" disabled>Select a request type…</option>
              {REQUEST_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Additional Details */}
          <div>
            <label htmlFor="gdpr-details" className="block text-sm font-bold text-[#32323F] mb-1.5">
              Additional Details <span className="text-[#32323F]/40 font-normal">(optional)</span>
            </label>
            <textarea
              id="gdpr-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              placeholder="Please describe your request in more detail, e.g. specific data categories or records…"
              className="w-full border border-[#E0EEF0] rounded-xl px-4 py-3 text-sm text-[#32323F] bg-white focus:outline-none focus:ring-2 focus:ring-[#006D77]/30 focus:border-[#006D77] transition-all resize-none placeholder:text-[#32323F]/30"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 font-semibold bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !requestType}
            className="w-full bg-[#006D77] hover:bg-[#005560] disabled:bg-[#006D77]/40 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit GDPR Request'
            )}
          </button>

          <p className="text-xs text-center text-[#32323F]/40 font-medium">
            By submitting this form, you confirm you are the data subject or their authorised representative. We will verify your identity before fulfilling any request.
          </p>
        </form>
      )}
    </LegalLayout>
  )
}
