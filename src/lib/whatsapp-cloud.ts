/**
 * WhatsApp Cloud API — Frontend Client
 * 
 * All actual API calls to Meta are made from the `send-whatsapp` Supabase Edge
 * Function, NOT directly from the browser. This file provides typed helpers
 * that call that function securely.
 *
 * Phone numbers must include the country code with no spaces or dashes.
 * Example: "447700900020" (UK) or "923001234567" (Pakistan)
 */

import { supabase } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WhatsAppTemplateParams = {
  templateName: string
  languageCode?: string
  parameters?: string[]
}

export type SendWhatsAppPayload = {
  to: string
  type: 'text' | 'template'
  /** Used when type === 'text' */
  textBody?: string
  /** Used when type === 'template' */
  template?: WhatsAppTemplateParams
  /** Optional — links a log entry to a patient */
  patientId?: string
  clinicId?: string
  messageType?: string
}

export type SendWhatsAppResult =
  | { success: true; messageId: string }
  | { success: false; error: string }

// ─── Core Sender ─────────────────────────────────────────────────────────────

/**
 * Routes a WhatsApp send request through the secure `send-whatsapp` Edge Function.
 */
export async function sendWhatsApp(payload: SendWhatsAppPayload): Promise<SendWhatsAppResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: payload,
    })

    if (error) throw error
    if (!data?.success) throw new Error(data?.error ?? 'Unknown error from send-whatsapp')

    return { success: true, messageId: data.messageId }
  } catch (e: any) {
    console.error('[WhatsApp] sendWhatsApp error:', e)
    return { success: false, error: e?.message ?? 'Failed to send WhatsApp message' }
  }
}

// ─── Convenience Senders ──────────────────────────────────────────────────────

/**
 * Send a plain text WhatsApp message.
 * NOTE: Text messages can only be sent to users who have messaged you first (24h window).
 * Use template messages for outbound marketing/notifications.
 */
export async function sendTextMessage(
  to: string,
  text: string,
  opts?: { patientId?: string; clinicId?: string }
): Promise<SendWhatsAppResult> {
  return sendWhatsApp({
    to,
    type: 'text',
    textBody: text,
    messageType: 'text',
    ...opts,
  })
}

/**
 * Send a pre-approved Meta message template.
 * 
 * @param to           Phone number with country code, no spaces (e.g. "447700900020")
 * @param templateName Template name as registered in Meta Business Manager
 * @param parameters   Ordered list of {{1}}, {{2}}, etc. parameter values
 * @param languageCode ISO 639 language code (default: 'en')
 */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  parameters?: string[],
  languageCode: string = 'en',
  opts?: { patientId?: string; clinicId?: string; messageType?: string }
): Promise<SendWhatsAppResult> {
  return sendWhatsApp({
    to,
    type: 'template',
    template: { templateName, languageCode, parameters },
    messageType: opts?.messageType ?? templateName,
    ...opts,
  })
}

// ─── KinetiMap-Specific Senders ───────────────────────────────────────────────

/**
 * booking_confirmation template
 * Body: Hi {{1}}, your appointment with {{2}} is confirmed for {{3}} at {{4}}. Location: {{5}}
 */
export async function sendBookingConfirmation(opts: {
  to: string
  patientName: string
  clinicName: string
  date: string   // e.g. "Monday, 15 April 2024"
  time: string   // e.g. "2:00 PM PKT"
  location?: string
  patientId?: string
  clinicId?: string
}) {
  return sendTemplateMessage(
    opts.to,
    'booking_confirmation',
    [opts.patientName, opts.clinicName, opts.date, opts.time, opts.location ?? 'our clinic'],
    'en',
    { patientId: opts.patientId, clinicId: opts.clinicId, messageType: 'booking_confirmation' }
  )
}

/**
 * appointment_reminder template
 * Body: Hi {{1}}, this is a reminder that your appointment with {{2}} is tomorrow at {{3}}.
 */
export async function sendAppointmentReminder(opts: {
  to: string
  patientName: string
  clinicName: string
  time: string   // e.g. "10:00 AM GMT"
  patientId?: string
  clinicId?: string
}) {
  return sendTemplateMessage(
    opts.to,
    'appointment_reminder',
    [opts.patientName, opts.clinicName, opts.time],
    'en',
    { patientId: opts.patientId, clinicId: opts.clinicId, messageType: 'appointment_reminder' }
  )
}

/**
 * followup_message template
 * Body: Hi {{1}}, how are you feeling after your session on {{2}}? Book your next: {{3}}
 */
export async function sendFollowUpMessage(opts: {
  to: string
  patientName: string
  sessionDate: string  // e.g. "12 April 2024"
  bookingLink: string  // e.g. "https://kinetimap.app/book/clinic-slug"
  patientId?: string
  clinicId?: string
}) {
  return sendTemplateMessage(
    opts.to,
    'followup_message',
    [opts.patientName, opts.sessionDate, opts.bookingLink],
    'en',
    { patientId: opts.patientId, clinicId: opts.clinicId, messageType: 'follow_up' }
  )
}

// ─── Phone Number Formatter ───────────────────────────────────────────────────

/**
 * Strips non-numeric characters from a phone number string.
 * Meta's Cloud API expects numbers like "447700900020", not "+44 7700 900020".
 */
export function formatPhoneForWhatsApp(phone: string): string {
  // Remove everything except digits
  return phone.replace(/\D/g, '')
}
