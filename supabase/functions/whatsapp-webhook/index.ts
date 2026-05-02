// supabase/functions/whatsapp-webhook/index.ts
// Supabase Edge Function — Meta WhatsApp Cloud API Webhook
//
// Handles:
//   GET  — Meta webhook verification challenge
//   POST — Incoming messages, delivery status, read receipts
//
// Secrets required:
//   WHATSAPP_WEBHOOK_VERIFY_TOKEN — any string you choose during webhook setup in Meta Developer Console

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WhatsAppEntry {
  id: string
  changes: WhatsAppChange[]
}

interface WhatsAppChange {
  value: {
    messaging_product: string
    metadata: { display_phone_number: string; phone_number_id: string }
    contacts?: { wa_id: string; profile: { name: string } }[]
    messages?: IncomingMessage[]
    statuses?: DeliveryStatus[]
  }
  field: string
}

interface IncomingMessage {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
}

interface DeliveryStatus {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  errors?: { code: number; title: string }[]
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const VERIFY_TOKEN = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ?? ''

  // ── GET: Webhook verification ─────────────────────────────────────────────
  if (req.method === 'GET') {
    const url    = new URL(req.url)
    const mode   = url.searchParams.get('hub.mode')
    const token  = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[webhook] Verification successful')
      return new Response(challenge ?? '', { status: 200 })
    }

    console.warn('[webhook] Verification failed — token mismatch')
    return new Response('Forbidden', { status: 403 })
  }

  // ── POST: Incoming event ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = await req.json()

      // Meta wraps events in body.entry[]
      const entries: WhatsAppEntry[] = body?.entry ?? []

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      for (const entry of entries) {
        for (const change of entry.changes) {
          if (change.field !== 'messages') continue

          const value = change.value

          // Handle incoming messages
          for (const msg of value.messages ?? []) {
            console.log('[webhook] Incoming message from:', msg.from, '| type:', msg.type)

            // Find patient by phone number
            const { data: patient } = await supabase
              .from('patients')
              .select('id, clinic_id, full_name')
              .eq('phone_number', msg.from)
              .maybeSingle()

            if (patient) {
              // Log the inbound message
              await supabase.from('whatsapp_messages').insert({
                patient_id:     patient.id,
                clinic_id:      patient.clinic_id,
                message_type:   'inbound',
                status:         'received',
                scheduled_for:  new Date(Number(msg.timestamp) * 1000).toISOString(),
                meta_message_id: msg.id,
                inbound_text:   msg.text?.body ?? null,
              }).then(({ error }) => {
                if (error) console.warn('[webhook] DB log inbound error:', error.message)
              })
            }

            // Auto-respond to CONFIRM keyword (best-effort)
            if (msg.text?.body?.trim()?.toUpperCase() === 'CONFIRM') {
              console.log('[webhook] Patient confirmed appointment:', msg.from)
              // Could call send-whatsapp here to send a confirmation acknowledgement
            }
          }

          // Handle delivery status updates
          for (const status of value.statuses ?? []) {
            console.log('[webhook] Delivery status:', status.status, 'for meta_message_id:', status.id)

            await supabase
              .from('whatsapp_messages')
              .update({
                status:           status.status,
                delivered_at:     status.status === 'delivered' ? new Date().toISOString() : undefined,
                read_at:          status.status === 'read' ? new Date().toISOString() : undefined,
              })
              .eq('meta_message_id', status.id)
              .then(({ error }) => {
                if (error) console.warn('[webhook] DB status update error:', error.message)
              })
          }
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    } catch (e: any) {
      console.error('[webhook] Error processing POST:', e)
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response('Method Not Allowed', { status: 405 })
})
