import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Ratelimit } from 'https://esm.sh/@upstash/ratelimit@1.0.0'
import { Redis } from 'https://esm.sh/@upstash/redis@1.22.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Handle CORS preflight requests
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

    // 6. Queue WhatsApp booking confirmation
    await supabase.from('whatsapp_messages').insert({
      clinic_id: booking.clinic_id,
      patient_id: booking.patient_id,
      message_type: 'booking_confirmation',
      status: 'queued',
      scheduled_for: new Date().toISOString(),
      context_type: 'booking_confirmation',
      context_booking_id: booking.id,
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
