import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Ratelimit } from 'https://esm.sh/@upstash/ratelimit@1.0.0'
import { Redis } from 'https://esm.sh/@upstash/redis@1.22.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a UTC ISO string for display in a given IANA timezone */
function formatInTZ(utcIso: string, timezone: string): { date: string; time: string } {
  try {
    const d = new Date(utcIso)
    const date = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      timeZone: timezone,
    }).format(d)
    const time = new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: timezone,
      timeZoneName: 'short',
    }).format(d)
    return { date, time }
  } catch {
    // Fallback if timezone is invalid
    const d = new Date(utcIso)
    return {
      date: d.toDateString(),
      time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }
  }
}

/** Dispatch a WhatsApp message via the send-whatsapp Edge Function */
async function dispatchWhatsApp(supabaseUrl: string, serviceKey: string, payload: Record<string, unknown>) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) {
      console.warn('[process-booking] send-whatsapp failed (non-fatal):', JSON.stringify(json))
    } else {
      console.log('[process-booking] WhatsApp confirmation sent. ID:', json.messageId)
    }
  } catch (e) {
    // Never let a WhatsApp failure break the booking
    console.warn('[process-booking] WhatsApp dispatch error (non-fatal):', e)
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Rate limiting via Upstash
    const UPSTASH_REDIS_URL   = Deno.env.get('UPSTASH_REDIS_URL')
    const UPSTASH_REDIS_TOKEN = Deno.env.get('UPSTASH_REDIS_TOKEN')

    if (!UPSTASH_REDIS_URL || !UPSTASH_REDIS_TOKEN) {
      console.warn('Missing Upstash credentials. Rate limiting disabled.')
    } else {
      const redis = new Redis({ url: UPSTASH_REDIS_URL, token: UPSTASH_REDIS_TOKEN })
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, '1 h'),
      })
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
      const { success } = await ratelimit.limit(ip)

      if (!success) {
        return new Response(
          JSON.stringify({ error: 'Too many booking attempts. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 2. Parse request body
    const {
      clinicId, fullName, whatsapp, dob, email, guardianName, guardianWhatsapp,
      selectedSlot, painData, redFlags, notes, appointmentPrice,
    } = await req.json()

    const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 3. Fetch clinic details (name, timezone, slug) for the WhatsApp message
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, timezone, slug')
      .eq('id', clinicId)
      .maybeSingle()

    const clinicName     = clinic?.name ?? 'your clinic'
    const clinicTimezone = clinic?.timezone ?? 'Europe/London'
    const clinicSlug     = clinic?.slug ?? ''

    // 4. Upsert patient
    const { data: existing } = await supabase
      .from('patients')
      .select('id')
      .eq('phone_number', whatsapp)
      .eq('clinic_id', clinicId)
      .maybeSingle()

    let patientId: string = existing?.id

    if (!patientId) {
      const { data: patient, error: patientErr } = await supabase.from('patients').insert({
        clinic_id:         clinicId,
        full_name:         fullName,
        phone_number:      whatsapp,
        email:             email || null,
        date_of_birth:     dob,
        gdpr_consent:      true,
        consent_date:      new Date().toISOString(),
        status_tag:        'active',
        primary_complaint: 'Online Booking',
        referral_source:   'Online Booking',
        guardian_name:     guardianName || null,
        guardian_whatsapp: guardianWhatsapp || null,
      }).select().single()

      if (patientErr) throw patientErr
      patientId = patient.id
    }

    // 5. Insert booking
    const { data: booking, error: bookingErr } = await supabase.from('bookings').insert({
      clinic_id:        clinicId,
      patient_id:       patientId,
      appointment_time: selectedSlot,
      appointment_price: appointmentPrice,
      pain_data:        painData,
      red_flags:        redFlags,
      status:           'upcoming',
      appointment_type: 'initial',
      notes:            notes,
    }).select().single()

    if (bookingErr) throw bookingErr

    // 6. Send WhatsApp booking confirmation (fire-and-forget)
    const { date: apptDate, time: apptTime } = formatInTZ(selectedSlot, clinicTimezone)
    const bookingLink = clinicSlug ? `https://kinetimap.app/book/${clinicSlug}` : 'https://kinetimap.app'

    await dispatchWhatsApp(SUPABASE_URL, SERVICE_ROLE_KEY, {
      to:          whatsapp,
      type:        'template',
      template: {
        templateName:  'booking_confirmation',
        languageCode:  'en',
        parameters:    [fullName, clinicName, apptDate, apptTime, 'our clinic'],
      },
      patientId:   patientId,
      clinicId:    clinicId,
      messageType: 'booking_confirmation',
    })

    return new Response(
      JSON.stringify({ success: true, bookingId: booking.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('[process-booking] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
